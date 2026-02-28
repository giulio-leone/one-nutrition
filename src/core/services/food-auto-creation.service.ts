/**
 * Food Auto-Creation Service
 *
 * Servizio centralizzato per creare automaticamente alimenti non presenti nel database
 * durante la generazione di piani nutrizionali AI.
 *
 * ARCHITETTURA:
 * - SSOT: Usa schemi da @giulio-leone/schemas per validazione
 * - Matching: Fuzzy match + macro similarity
 * - Batch processing per efficienza
 * - Logging dettagliato per tracciabilità
 *
 * FLUSSO:
 * 1. AI genera alimenti con schema AIGeneratedFoodSchema
 * 2. FoodAutoCreationService processa tutti gli alimenti
 * 3. Per ogni alimento: match esistente o crea nuovo
 * 4. Restituisce mappa di foodItemId validi
 */

import { FoodService, normalizeFoodName } from '@giulio-leone/lib-food';
import type { Macros, NutritionPlan } from '@giulio-leone/types';
import { ServiceRegistry, REPO_TOKENS } from '@giulio-leone/core';
import type { IFoodRepository, CreateFoodItemInput } from '@giulio-leone/core/repositories';
import { createId } from '@giulio-leone/lib-shared/id-generator';
import { SUPPORTED_FOOD_LOCALES } from '@giulio-leone/constants';
import { logger } from '@giulio-leone/lib-core';
import {
  type AIGeneratedFood,
  safeValidateAIGeneratedFood,
  aiGeneratedFoodToFoodToCreate,
  AI_FOOD_DEFAULTS,
} from '@giulio-leone/schemas';
import { calculateMainMacro, type MainMacro } from '@giulio-leone/lib-shared';

const getFoodRepo = () =>
  ServiceRegistry.getInstance().resolve<IFoodRepository>(REPO_TOKENS.FOOD);

// ============================================================================
// CONSTANTS
// ============================================================================

const IS_DEV = process.env.NODE_ENV === 'development';

/** Threshold per matching fuzzy (85% = molto simile) */
const CLOSE_MATCH_THRESHOLD = 0.85;

/** Tolleranza per matching macros (15% differenza accettabile) */
const MACRO_TOLERANCE_PERCENT = 15;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Food da processare dall'output AI
 * Estende AIGeneratedFood con campi aggiuntivi per il processing
 */
export interface FoodToProcess {
  /** ID temporaneo del food nel piano (per mappatura) */
  id?: string;
  /** Nome alimento */
  name: string;
  /** Macros per 100g */
  macrosPer100g: Macros;
  /** Unità di misura */
  unit: string;
  /** Porzione standard */
  servingSize: number;
  /** Descrizione (OBBLIGATORIA) */
  description: string;
  /** Nome brand */
  brandName?: string;
  /** URL immagine */
  imageUrl?: string | null;
  /** Barcode */
  barcode?: string | null;
  /** Categoria */
  category?: string;
}

/**
 * Risultato del matching/creazione alimento
 */
export interface FoodCreationResult {
  id: string;
  name: string;
  existed: boolean;
  status: 'existing' | 'created' | 'matched' | 'error';
  matchType?: 'exact' | 'fuzzy' | 'created';
  confidence?: number;
}

/**
 * Risultato batch processing
 */
export interface BatchResolutionResult {
  resolved: Map<string, FoodCreationResult>;
  created: number;
  matched: number;
  existing: number;
  errors: Array<{ name: string; error: string }>;
}

// ============================================================================
// FOOD AUTO-CREATION SERVICE
// ============================================================================

/**
 * Servizio centralizzato per la creazione automatica di alimenti
 *
 * @example
 * ```typescript
 * // Processa alimenti da AI output
 * const result = await FoodAutoCreationService.batchProcessFoods(aiGeneratedFoods);
 *
 * // Processa un intero piano nutrizionale
 * const { plan, stats } = await FoodAutoCreationService.processNutritionPlan(nutritionPlan);
 * ```
 */
export class FoodAutoCreationService {
  // ==========================================================================
  // BATCH PROCESSING
  // ==========================================================================

  /**
   * Processa batch di alimenti: match esistente o crea nuovo
   *
   * @param foods Array di alimenti da processare
   * @returns Mappa normalizedName -> FoodCreationResult
   */
  static async batchProcessFoods(
    foods: ReadonlyArray<FoodToProcess>
  ): Promise<BatchResolutionResult> {
    const result: BatchResolutionResult = {
      resolved: new Map(),
      created: 0,
      matched: 0,
      existing: 0,
      errors: [],
    };

    // Deduplicate per nome normalizzato
    const uniqueFoods = new Map<string, FoodToProcess>();
    for (const food of foods) {
      const normalizedName = normalizeFoodName(food.name);
      // Mantieni quello con più dati (es. description presente)
      const existing = uniqueFoods.get(normalizedName);
      if (!existing || (food.description && !existing.description)) {
        uniqueFoods.set(normalizedName, food);
      }
    }

    if (IS_DEV) {
      logger.warn(
        `[FoodAutoCreation] Processing ${uniqueFoods.size} unique foods from ${foods.length} total`
      );
    }

    // Processa in parallelo per performance
    const processingPromises = Array.from(uniqueFoods.entries()).map(
      async ([normalizedName, food]) => {
        try {
          const resolution = await this.matchOrCreateFood(food);
          return { normalizedName, resolution, error: null };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`[FoodAutoCreation] Error processing "${food.name}":`, errorMessage);
          return {
            normalizedName,
            resolution: null,
            error: { name: food.name, error: errorMessage },
          };
        }
      }
    );

    const settledResults = await Promise.allSettled(processingPromises);

    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        const { normalizedName, resolution, error } = settled.value;
        if (resolution) {
          result.resolved.set(normalizedName, resolution);
          if (resolution.status === 'created') result.created++;
          else if (resolution.status === 'matched') result.matched++;
          else if (resolution.status === 'existing') result.existing++;
        }
        if (error) {
          result.errors.push(error);
        }
      }
    }

    logger.warn(
      `[FoodAutoCreation] Batch complete: ${result.created} created, ${result.matched} matched, ${result.existing} existing, ${result.errors.length} errors`
    );

    return result;
  }

  // ==========================================================================
  // SINGLE FOOD PROCESSING
  // ==========================================================================

  /**
   * Match o crea un singolo alimento
   *
   * Flusso:
   * 1. Cerca match esatto per nome normalizzato
   * 2. Se non trovato, cerca fuzzy match (nome + macros)
   * 3. Se score >= 85%, usa esistente
   * 4. Altrimenti, crea nuovo alimento con traduzioni
   */
  static async matchOrCreateFood(food: FoodToProcess): Promise<FoodCreationResult> {
    const normalizedName = normalizeFoodName(food.name);

    // 1. Cerca match esatto per nome
    const exactMatch = await FoodService.getFoodByNameNormalized(normalizedName);
    if (exactMatch) {
      return {
        id: exactMatch.id,
        name: exactMatch.name,
        existed: true,
        status: 'existing',
        matchType: 'exact',
        confidence: 100,
      };
    }

    // 2. Cerca fuzzy match (BM25 + similarity)
    const searchResults = await FoodService.searchFoods(food.name, { limit: 10 });
    if (searchResults.length > 0) {
      const bestMatch = this.findBestMatch(food.name, food.macrosPer100g, searchResults);
      if (bestMatch) {
        logger.warn(
          `[FoodAutoCreation] Fuzzy match for "${food.name}": "${bestMatch.match.name}" (${(bestMatch.score * 100).toFixed(1)}%)`
        );
        return {
          id: bestMatch.match.id,
          name: bestMatch.match.name,
          existed: true,
          status: 'matched',
          matchType: 'fuzzy',
          confidence: Math.round(bestMatch.score * 100),
        };
      }
    }

    // 3. Nessun match trovato - crea nuovo alimento
    logger.warn(`[FoodAutoCreation] Creating new food: "${food.name}"`);
    const newFood = await this.createFoodInDatabase(food);

    return {
      id: newFood.id,
      name: newFood.name,
      existed: false,
      status: 'created',
      matchType: 'created',
    };
  }

  // ==========================================================================
  // DATABASE CREATION
  // ==========================================================================

  /**
   * Crea un alimento nel database con tutte le traduzioni
   */
  private static async createFoodInDatabase(
    food: FoodToProcess
  ): Promise<{ id: string; name: string }> {
    const foodId = createId();
    const nameNormalized = normalizeFoodName(food.name);

    // Calcola percentuali macro (REQUIRED dal DB)
    const totalKcal = Math.max(1, food.macrosPer100g.calories || 0);
    const proteinPct = Math.min(
      100,
      Math.max(0, ((food.macrosPer100g.protein || 0) * 4 * 100) / totalKcal)
    );
    const carbPct = Math.min(
      100,
      Math.max(0, ((food.macrosPer100g.carbs || 0) * 4 * 100) / totalKcal)
    );
    const fatPct = Math.min(
      100,
      Math.max(0, ((food.macrosPer100g.fats || 0) * 9 * 100) / totalKcal)
    );

    // Calcola mainMacro
    const mainMacro: MainMacro = calculateMainMacro(food.macrosPer100g);

    // Gestione brand
    let brandId: string | undefined;
    if (food.brandName && food.brandName !== 'Generic') {
      brandId = await this.findOrCreateBrand(food.brandName);
    }

    // Prepara description con fallback robusto
    const description = this.ensureValidDescription(food.description, food.name);

    // Crea food con traduzioni per tutti i locali supportati
    const foodData: CreateFoodItemInput = {
      id: foodId,
      name: food.name,
      nameNormalized,
      macrosPer100g: food.macrosPer100g,
      servingSize: food.servingSize || AI_FOOD_DEFAULTS.servingSize,
      unit: food.unit || AI_FOOD_DEFAULTS.unit,
      mainMacro: mainMacro,
      proteinPct,
      carbPct,
      fatPct,
      brandId: brandId,
      ...(food.imageUrl && String(food.imageUrl).trim() !== '' && { imageUrl: food.imageUrl }),
      ...(food.barcode && String(food.barcode).trim() !== '' && { barcode: food.barcode }),
      translations: SUPPORTED_FOOD_LOCALES.map((locale: string) => ({
        id: createId(),
        locale,
        name: food.name,
        description: description,
      })),
    };

    try {
      const newFood = await getFoodRepo().createFood(foodData);

      return { id: newFood.id, name: newFood.name };
    } catch (error: any) {
      // Handle Unique Constraint Violation (P2002)
      // This happens if the food was created by another process/thread between our check and creation
      if (error.code === 'P2002') {
        logger.warn(
          `[FoodAutoCreation] Food "${food.name}" already exists (race condition). Fetching existing...`
        );
        const existing = await getFoodRepo().findFirst({ nameNormalized });
        if (existing) {
          return { id: existing.id, name: existing.name };
        }
      }
      throw error;
    }
  }

  /**
   * Trova o crea un brand
   */
  private static async findOrCreateBrand(brandName: string): Promise<string | undefined> {
    const brandNameNormalized = normalizeFoodName(brandName);
    try {
      const existingBrand = await getFoodRepo().findBrandByNormalizedName(brandNameNormalized);

      if (existingBrand) {
        return existingBrand.id;
      }

      const newBrand = await getFoodRepo().createBrand({
        id: createId(),
        name: brandName,
        nameNormalized: brandNameNormalized,
      });
      return newBrand.id;
    } catch (error) {
      logger.error('[FoodAutoCreation] Error creating brand:', error);
      return undefined;
    }
  }

  /**
   * Assicura che la description sia sempre valida (non null/empty)
   */
  private static ensureValidDescription(
    description: string | undefined | null,
    foodName: string
  ): string {
    if (description && description.trim().length >= 10) {
      return description.trim();
    }
    // Genera description di fallback
    return `${foodName} - nutritious food item commonly used in balanced diets. Contains essential macronutrients for a healthy lifestyle.`;
  }

  // ==========================================================================
  // FUZZY MATCHING
  // ==========================================================================

  /**
   * Trova il miglior match tra i risultati di ricerca
   */
  private static findBestMatch(
    targetName: string,
    targetMacros: Macros,
    searchResults: ReadonlyArray<{ id: string; name: string; macrosPer100g: Macros }>
  ): { match: { id: string; name: string }; score: number } | null {
    let bestMatch: { id: string; name: string } | null = null;
    let bestScore = 0;

    for (const result of searchResults) {
      const nameSimilarity = this.stringSimilarity(targetName, result.name);
      const macroSimilarity = this.macroSimilarity(targetMacros, result.macrosPer100g);

      // Score combinato: 60% nome, 40% macros
      const combinedScore = nameSimilarity * 0.6 + macroSimilarity * 0.4;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMatch = { id: result.id, name: result.name };
      }
    }

    if (bestMatch && bestScore >= CLOSE_MATCH_THRESHOLD) {
      return { match: bestMatch, score: bestScore };
    }

    return null;
  }

  /**
   * Calcola Levenshtein distance
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      if (matrix[0]) matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const row = matrix[i];
        const prevRow = matrix[i - 1];
        if (row && prevRow) {
          row[j] = Math.min(
            (prevRow[j] ?? Infinity) + 1,
            (row[j - 1] ?? Infinity) + 1,
            (prevRow[j - 1] ?? Infinity) + cost
          );
        }
      }
    }

    return matrix[len1]?.[len2] ?? Math.max(len1, len2);
  }

  /**
   * Calcola similarità stringa (0-1)
   */
  private static stringSimilarity(str1: string, str2: string): number {
    const normalized1 = normalizeFoodName(str1);
    const normalized2 = normalizeFoodName(str2);

    if (normalized1 === normalized2) return 1.0;

    const maxLen = Math.max(normalized1.length, normalized2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(normalized1, normalized2);
    return 1 - distance / maxLen;
  }

  /**
   * Calcola similarità macros (0-1)
   */
  private static macroSimilarity(macros1: Macros, macros2: Macros): number {
    const keys: (keyof Macros)[] = ['calories', 'protein', 'carbs', 'fats'];
    let totalScore = 0;
    let count = 0;

    for (const key of keys) {
      const val1 = macros1[key] || 0;
      const val2 = macros2[key] || 0;

      if (val1 === 0 && val2 === 0) {
        totalScore += 1;
        count++;
        continue;
      }

      const maxVal = Math.max(val1, val2);
      if (maxVal === 0) continue;

      const diff = Math.abs(val1 - val2);
      const percentDiff = (diff / maxVal) * 100;

      const score = percentDiff <= MACRO_TOLERANCE_PERCENT ? 1 : 1 - percentDiff / 100;
      totalScore += Math.max(0, score);
      count++;
    }

    return count > 0 ? totalScore / count : 0;
  }

  // ==========================================================================
  // PLAN PROCESSING
  // ==========================================================================

  /**
   * Processa un intero piano nutrizionale e risolve/crea tutti gli alimenti
   *
   * @param plan Piano nutrizionale dall'AI
   * @returns Piano aggiornato con foodItemId validi + statistiche
   */
  static async processNutritionPlan(plan: NutritionPlan): Promise<{
    plan: NutritionPlan;
    stats: BatchResolutionResult;
  }> {
    // Estrai tutti gli alimenti dal piano
    const foodsToProcess: FoodToProcess[] = [];
    const foodIdToNormalizedName = new Map<string, string>();

    for (const week of plan.weeks) {
      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const food of meal.foods) {
            if (!food.name || food.name.trim() === '') continue;

            const normalizedName = normalizeFoodName(food.name);
            foodIdToNormalizedName.set(food.id, normalizedName);

            // Estrai campi AI-generated se presenti
            const aiFood = food as typeof food & {
              servingSize?: number;
              brandName?: string;
              imageUrl?: string;
              barcode?: string;
            };

            foodsToProcess.push({
              id: food.id,
              name: food.name,
              macrosPer100g: food.macros || { calories: 0, protein: 0, carbs: 0, fats: 0 },
              unit: food.unit || 'g',
              servingSize: aiFood.servingSize || 100,
              description:
                food.notes ||
                `${food.name} - nutritious food item commonly used in balanced diets.`,
              brandName: aiFood.brandName,
              imageUrl: aiFood.imageUrl,
              barcode: aiFood.barcode,
            });
          }
        }
      }
    }

    // Processa tutti gli alimenti
    const stats = await this.batchProcessFoods(foodsToProcess);

    // Aggiorna piano con foodItemId reali
    const updatedPlan: NutritionPlan = {
      ...plan,
      weeks: plan.weeks.map((week: any) => ({
        ...week,
        days: week.days.map((day: any) => ({
          ...day,
          meals: day.meals.map((meal: any) => ({
            ...meal,
            foods: meal.foods.map((food: any) => {
              const normalizedName = foodIdToNormalizedName.get(food.id);
              const resolution = normalizedName ? stats.resolved.get(normalizedName) : undefined;

              if (resolution) {
                return {
                  ...food,
                  foodItemId: resolution.id,
                };
              }
              return food;
            }),
          })),
        })),
      })),
    };

    return { plan: updatedPlan, stats };
  }

  /**
   * Valida che tutti gli alimenti in un piano abbiano foodItemId validi
   */
  static async validatePlanFoods(plan: NutritionPlan): Promise<{
    valid: boolean;
    missingFoods: Array<{ id: string; name: string; mealName: string; dayNumber: number }>;
  }> {
    const missingFoods: Array<{ id: string; name: string; mealName: string; dayNumber: number }> =
      [];

    for (const week of plan.weeks) {
      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const food of meal.foods) {
            if (!food.foodItemId) {
              missingFoods.push({
                id: food.id,
                name: food.name || 'Unknown',
                mealName: meal.name,
                dayNumber: day.dayNumber,
              });
            } else {
              // Verifica esistenza nel DB
              const exists = await FoodService.getFoodById(food.foodItemId);
              if (!exists) {
                missingFoods.push({
                  id: food.id,
                  name: food.name || 'Unknown',
                  mealName: meal.name,
                  dayNumber: day.dayNumber,
                });
              }
            }
          }
        }
      }
    }

    return {
      valid: missingFoods.length === 0,
      missingFoods,
    };
  }

  // ==========================================================================
  // AI FOOD CONVERSION
  // ==========================================================================

  /**
   * Converte array di AIGeneratedFood in FoodToProcess
   * Valida ogni food con lo schema SSOT
   */
  static convertAIFoodsToProcess(
    aiFoods: ReadonlyArray<Partial<AIGeneratedFood>>
  ): FoodToProcess[] {
    const result: FoodToProcess[] = [];

    for (const aiFood of aiFoods) {
      const validation = safeValidateAIGeneratedFood(aiFood);

      if (validation.success) {
        const food = aiGeneratedFoodToFoodToCreate(validation.data);
        result.push({
          name: food.name,
          macrosPer100g: food.macrosPer100g,
          unit: food.unit,
          servingSize: food.servingSize,
          description: food.description,
          brandName: food.brandName,
          imageUrl: food.imageUrl ?? undefined,
          barcode: food.barcode ?? undefined,
        });
      } else {
        // Log warning ma processa comunque con defaults
        logger.warn(`[FoodAutoCreation] AIFood validation failed for "${aiFood.name}":`, {
          errors: validation.error.issues.map((i: any) => i.message).join(', '),
        });

        // Processa con defaults
        if (aiFood.name && aiFood.macros) {
          result.push({
            name: aiFood.name,
            macrosPer100g: {
              calories: aiFood.macros.calories || 0,
              protein: aiFood.macros.protein || 0,
              carbs: aiFood.macros.carbs || 0,
              fats: aiFood.macros.fats || 0,
              fiber: aiFood.macros.fiber,
            },
            unit: aiFood.unit || 'g',
            servingSize: aiFood.servingSize || 100,
            description:
              aiFood.description ||
              `${aiFood.name} - nutritious food item commonly used in balanced diets.`,
            brandName: aiFood.brandName,
            imageUrl: aiFood.imageUrl ?? undefined,
            barcode: aiFood.barcode ?? undefined,
          });
        }
      }
    }

    return result;
  }
}

export default FoodAutoCreationService;
