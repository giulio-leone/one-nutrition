/**
 * @onecoach/lib-nutrition - Nutrition Calculator (SSOT)
 *
 * Single Source of Truth per tutti i calcoli nutrizionali.
 * Questo modulo centralizza:
 * - Calcolo BMR (Mifflin-St Jeor)
 * - Calcolo TDEE
 * - Distribuzione macro per diet type
 * - Validazione range sicuri
 *
 * NON DUPLICARE queste formule altrove!
 */ import { logger } from '@onecoach/lib-core';

// ============================================
// TYPES
// ============================================

export type Gender = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type NutritionGoal =
  | 'weight_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'performance'
  | 'health'
  | 'body_recomposition';

export type DietType =
  | 'omnivore'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'keto'
  | 'paleo'
  | 'mediterranean';

export interface UserMetrics {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
}

export interface MacroDistribution {
  protein: number; // grammi
  carbs: number; // grammi
  fat: number; // grammi
  calories: number; // kcal totali (calcolate dai macro)
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  deficit?: number; // kcal sotto TDEE (positivo = deficit)
  surplus?: number; // kcal sopra TDEE (positivo = surplus)
  macros: MacroDistribution;
}

export interface CalorieCalculationResult {
  bmr: number;
  tdee: number;
}

export interface MacroRatios {
  proteinRatio: number; // % delle calorie
  carbsRatio: number; // % delle calorie
  fatRatio: number; // % delle calorie
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Moltiplicatori attività per calcolo TDEE
 * Basati su letteratura scientifica standard
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // Poco o nessun esercizio
  light: 1.375, // Esercizio leggero 1-3 giorni/settimana
  moderate: 1.55, // Esercizio moderato 3-5 giorni/settimana
  active: 1.725, // Esercizio intenso 6-7 giorni/settimana
  very_active: 1.9, // Esercizio molto intenso + lavoro fisico
};

/**
 * Kcal per grammo di macronutriente
 */
export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/**
 * Proteine raccomandate per kg di peso corporeo in base al goal
 * Basate su evidenze scientifiche (ISSN, ACSM)
 */
export const PROTEIN_PER_KG_BY_GOAL: Record<NutritionGoal, { min: number; max: number }> = {
  weight_loss: { min: 1.6, max: 2.4 }, // Più alte per preservare massa magra
  muscle_gain: { min: 1.6, max: 2.2 }, // ISSN raccomanda 1.6-2.2 g/kg
  maintenance: { min: 1.2, max: 1.6 }, // Mantenimento standard
  performance: { min: 1.4, max: 2.0 }, // Atleti di endurance/performance
  health: { min: 1.0, max: 1.4 }, // Salute generale
  body_recomposition: { min: 1.8, max: 2.4 }, // Alto per preservare/costruire massa
};

/**
 * Distribuzione macro di DEFAULT per diet type
 * Valori in % delle calorie totali
 * L'AI può modificare questi valori entro i range sicuri
 */
export const DEFAULT_MACRO_RATIOS_BY_DIET: Record<DietType, MacroRatios> = {
  omnivore: { proteinRatio: 0.25, carbsRatio: 0.45, fatRatio: 0.3 },
  vegetarian: { proteinRatio: 0.2, carbsRatio: 0.5, fatRatio: 0.3 },
  vegan: { proteinRatio: 0.18, carbsRatio: 0.52, fatRatio: 0.3 },
  pescatarian: { proteinRatio: 0.25, carbsRatio: 0.45, fatRatio: 0.3 },
  keto: { proteinRatio: 0.25, carbsRatio: 0.05, fatRatio: 0.7 },
  paleo: { proteinRatio: 0.3, carbsRatio: 0.3, fatRatio: 0.4 },
  mediterranean: { proteinRatio: 0.2, carbsRatio: 0.45, fatRatio: 0.35 },
};

/**
 * Range sicuri per validazione
 */
export const SAFETY_RANGES = {
  // Calorie minime/massime assolute
  minCalories: 1200,
  maxCalories: 5000,

  // Deficit/surplus massimi (kcal)
  maxDeficit: 1000, // Non più di 1000 kcal/giorno sotto TDEE
  maxSurplus: 500, // Non più di 500 kcal/giorno sopra TDEE

  // Percentuali macro (delle calorie totali)
  fat: { min: 0.15, max: 0.45 }, // 15-45% delle calorie
  protein: { min: 0.1, max: 0.4 }, // 10-40% delle calorie
  carbs: { min: 0.05, max: 0.65 }, // 5-65% (keto può essere molto basso)

  // Proteine per kg
  proteinPerKg: { min: 0.8, max: 3.0 }, // Range assoluto sicuro

  // BMR range di sanity check
  bmr: { min: 1000, max: 3000 },

  // TDEE range di sanity check
  tdee: { min: 1200, max: 5500 },
} as const;

// ============================================
// CORE CALCULATION FUNCTIONS
// ============================================

/**
 * Calcola il BMR usando la formula Mifflin-St Jeor
 * Considerata la più accurata per la popolazione generale
 *
 * Formula:
 * - Uomini: (10 × peso in kg) + (6.25 × altezza in cm) - (5 × età) + 5
 * - Donne: (10 × peso in kg) + (6.25 × altezza in cm) - (5 × età) - 161
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const genderOffset = gender === 'male' ? 5 : -161;
  const bmr = baseBMR + genderOffset;

  // Sanity check
  if (bmr < SAFETY_RANGES.bmr.min || bmr > SAFETY_RANGES.bmr.max) {
    logger.warn(`[NutritionCalculator] BMR ${bmr} fuori range normale, controllare input`);
  }

  return Math.round(bmr);
}

/**
 * Calcola il TDEE (Total Daily Energy Expenditure)
 * TDEE = BMR × Moltiplicatore Attività
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  const tdee = bmr * multiplier;

  // Sanity check
  if (tdee < SAFETY_RANGES.tdee.min || tdee > SAFETY_RANGES.tdee.max) {
    logger.warn(`[NutritionCalculator] TDEE ${tdee} fuori range normale, controllare input`);
  }

  return Math.round(tdee);
}

/**
 * Calcola BMR e TDEE insieme
 * Funzione di convenienza per ottenere entrambi i valori
 */
export function calculateCalorieNeeds(metrics: UserMetrics): CalorieCalculationResult {
  const bmr = calculateBMR(metrics.weightKg, metrics.heightCm, metrics.age, metrics.gender);
  const tdee = calculateTDEE(bmr, metrics.activityLevel);

  return { bmr, tdee };
}

// ============================================
// MACRO CALCULATION FUNCTIONS
// ============================================

/**
 * Calcola i macro in grammi da calorie e ratios
 */
export function calculateMacrosFromRatios(
  targetCalories: number,
  ratios: MacroRatios
): MacroDistribution {
  const proteinCalories = targetCalories * ratios.proteinRatio;
  const carbsCalories = targetCalories * ratios.carbsRatio;
  const fatCalories = targetCalories * ratios.fatRatio;

  return {
    protein: Math.round(proteinCalories / KCAL_PER_GRAM.protein),
    carbs: Math.round(carbsCalories / KCAL_PER_GRAM.carbs),
    fat: Math.round(fatCalories / KCAL_PER_GRAM.fat),
    calories: targetCalories,
  };
}

/**
 * Calcola i macro basandosi su diet type, goal e peso
 * Usa proteine basate sul peso (g/kg) e distribuisce il resto
 */
export function calculateMacrosByDietType(
  targetCalories: number,
  dietType: DietType,
  weightKg: number,
  goal: NutritionGoal
): MacroDistribution {
  // 1. Determina proteine in base al goal (g/kg)
  const proteinRange = PROTEIN_PER_KG_BY_GOAL[goal];
  // Usa il valore medio del range
  const proteinPerKg = (proteinRange.min + proteinRange.max) / 2;
  const proteinGrams = Math.round(weightKg * proteinPerKg);
  const proteinCalories = proteinGrams * KCAL_PER_GRAM.protein;

  // 2. Ottieni ratios di default per il diet type
  const defaultRatios = DEFAULT_MACRO_RATIOS_BY_DIET[dietType];

  // 3. Calcola calorie rimanenti dopo le proteine
  const remainingCalories = targetCalories - proteinCalories;

  // 4. Distribuisci carbs e fat proporzionalmente ai ratios di default
  // (escludendo le proteine già calcolate)
  const carbsFatTotal = defaultRatios.carbsRatio + defaultRatios.fatRatio;
  const adjustedCarbsRatio = defaultRatios.carbsRatio / carbsFatTotal;
  const adjustedFatRatio = defaultRatios.fatRatio / carbsFatTotal;

  const carbsCalories = remainingCalories * adjustedCarbsRatio;
  const fatCalories = remainingCalories * adjustedFatRatio;

  const macros: MacroDistribution = {
    protein: proteinGrams,
    carbs: Math.round(carbsCalories / KCAL_PER_GRAM.carbs),
    fat: Math.round(fatCalories / KCAL_PER_GRAM.fat),
    calories: targetCalories,
  };

  // 5. Valida i grassi (range 15-45%)
  const fatRatio = fatCalories / targetCalories;
  if (fatRatio < SAFETY_RANGES.fat.min) {
    // Grassi troppo bassi, ribilancia
    const minFatCalories = targetCalories * SAFETY_RANGES.fat.min;
    const minFatGrams = Math.round(minFatCalories / KCAL_PER_GRAM.fat);
    const adjustedCarbsCalories = remainingCalories - minFatCalories;

    macros.fat = minFatGrams;
    macros.carbs = Math.round(adjustedCarbsCalories / KCAL_PER_GRAM.carbs);

    logger.warn(
      `[NutritionCalculator] Fat ratio ${(fatRatio * 100).toFixed(1)}% < 15%, adjusted to minimum`
    );
  } else if (fatRatio > SAFETY_RANGES.fat.max && dietType !== 'keto') {
    // Grassi troppo alti (eccetto keto)
    const maxFatCalories = targetCalories * SAFETY_RANGES.fat.max;
    const maxFatGrams = Math.round(maxFatCalories / KCAL_PER_GRAM.fat);
    const adjustedCarbsCalories = remainingCalories - maxFatCalories;

    macros.fat = maxFatGrams;
    macros.carbs = Math.round(adjustedCarbsCalories / KCAL_PER_GRAM.carbs);

    logger.warn(
      `[NutritionCalculator] Fat ratio ${(fatRatio * 100).toFixed(1)}% > 45%, adjusted to maximum`
    );
  }

  return macros;
}

// ============================================
// TARGET CALORIES CALCULATION
// ============================================

/**
 * Suggerisce calorie target basate su goal
 * NOTA: Questi sono valori di riferimento, l'AI può modificarli
 * entro i range sicuri definiti in SAFETY_RANGES
 */
export function suggestTargetCalories(
  tdee: number,
  goal: NutritionGoal
): { targetCalories: number; deficit?: number; surplus?: number } {
  switch (goal) {
    case 'weight_loss':
      // Deficit moderato del 15-20%
      const deficit = Math.min(Math.round(tdee * 0.18), SAFETY_RANGES.maxDeficit);
      return {
        targetCalories: tdee - deficit,
        deficit,
      };

    case 'muscle_gain':
      // Surplus moderato del 10-15%
      const surplus = Math.min(Math.round(tdee * 0.12), SAFETY_RANGES.maxSurplus);
      return {
        targetCalories: tdee + surplus,
        surplus,
      };

    case 'body_recomposition':
      // Leggero deficit o maintenance
      const recompDeficit = Math.round(tdee * 0.05);
      return {
        targetCalories: tdee - recompDeficit,
        deficit: recompDeficit,
      };

    case 'performance':
      // Leggero surplus per supportare allenamento
      const perfSurplus = Math.min(Math.round(tdee * 0.08), SAFETY_RANGES.maxSurplus);
      return {
        targetCalories: tdee + perfSurplus,
        surplus: perfSurplus,
      };

    case 'maintenance':
    case 'health':
    default:
      return {
        targetCalories: tdee,
      };
  }
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida che i valori nutrizionali siano nei range sicuri
 */
export function validateNutritionTargets(
  targets: NutritionTargets,
  weightKg: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Valida calorie totali
  if (targets.targetCalories < SAFETY_RANGES.minCalories) {
    errors.push(
      `Calorie ${targets.targetCalories} sotto il minimo sicuro (${SAFETY_RANGES.minCalories})`
    );
  }
  if (targets.targetCalories > SAFETY_RANGES.maxCalories) {
    errors.push(
      `Calorie ${targets.targetCalories} sopra il massimo sicuro (${SAFETY_RANGES.maxCalories})`
    );
  }

  // 2. Valida deficit/surplus
  if (targets.deficit && targets.deficit > SAFETY_RANGES.maxDeficit) {
    errors.push(
      `Deficit ${targets.deficit} kcal troppo aggressivo (max ${SAFETY_RANGES.maxDeficit})`
    );
  }
  if (targets.surplus && targets.surplus > SAFETY_RANGES.maxSurplus) {
    warnings.push(`Surplus ${targets.surplus} kcal alto, rischio accumulo grasso`);
  }

  // 3. Valida proteine per kg
  const proteinPerKg = targets.macros.protein / weightKg;
  if (proteinPerKg < SAFETY_RANGES.proteinPerKg.min) {
    warnings.push(`Proteine ${proteinPerKg.toFixed(1)} g/kg sotto il minimo raccomandato`);
  }
  if (proteinPerKg > SAFETY_RANGES.proteinPerKg.max) {
    errors.push(`Proteine ${proteinPerKg.toFixed(1)} g/kg sopra il massimo sicuro`);
  }

  // 4. Valida percentuale grassi (NUOVO - mancava!)
  const fatCalories = targets.macros.fat * KCAL_PER_GRAM.fat;
  const fatRatio = fatCalories / targets.targetCalories;
  if (fatRatio < SAFETY_RANGES.fat.min) {
    errors.push(
      `Grassi ${(fatRatio * 100).toFixed(0)}% sotto il minimo (${SAFETY_RANGES.fat.min * 100}%)`
    );
  }
  if (fatRatio > SAFETY_RANGES.fat.max) {
    warnings.push(
      `Grassi ${(fatRatio * 100).toFixed(0)}% sopra il massimo raccomandato (${SAFETY_RANGES.fat.max * 100}%)`
    );
  }

  // 5. Valida somma macro = calorie
  const calculatedCalories =
    targets.macros.protein * KCAL_PER_GRAM.protein +
    targets.macros.carbs * KCAL_PER_GRAM.carbs +
    targets.macros.fat * KCAL_PER_GRAM.fat;
  const caloriesDiff = Math.abs(calculatedCalories - targets.targetCalories);
  if (caloriesDiff > 50) {
    warnings.push(
      `Macro non coerenti: ${calculatedCalories} kcal vs target ${targets.targetCalories} kcal`
    );
  }

  // 6. Sanity check BMR/TDEE
  if (targets.bmr < SAFETY_RANGES.bmr.min || targets.bmr > SAFETY_RANGES.bmr.max) {
    warnings.push(`BMR ${targets.bmr} fuori range normale`);
  }
  if (targets.tdee < SAFETY_RANGES.tdee.min || targets.tdee > SAFETY_RANGES.tdee.max) {
    warnings.push(`TDEE ${targets.tdee} fuori range normale`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida macro ratios
 */
export function validateMacroRatios(ratios: MacroRatios): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sum = ratios.proteinRatio + ratios.carbsRatio + ratios.fatRatio;
  if (Math.abs(sum - 1.0) > 0.01) {
    errors.push(`Somma ratios ${(sum * 100).toFixed(0)}% ≠ 100%`);
  }

  if (ratios.fatRatio < SAFETY_RANGES.fat.min) {
    errors.push(
      `Fat ratio ${(ratios.fatRatio * 100).toFixed(0)}% < ${SAFETY_RANGES.fat.min * 100}%`
    );
  }
  if (ratios.fatRatio > SAFETY_RANGES.fat.max) {
    warnings.push(
      `Fat ratio ${(ratios.fatRatio * 100).toFixed(0)}% > ${SAFETY_RANGES.fat.max * 100}%`
    );
  }

  if (ratios.proteinRatio < SAFETY_RANGES.protein.min) {
    warnings.push(`Protein ratio ${(ratios.proteinRatio * 100).toFixed(0)}% basso`);
  }
  if (ratios.proteinRatio > SAFETY_RANGES.protein.max) {
    warnings.push(`Protein ratio ${(ratios.proteinRatio * 100).toFixed(0)}% molto alto`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// COMPLETE CALCULATION PIPELINE
// ============================================

/**
 * Calcola tutti i target nutrizionali in un'unica chiamata
 * Questa è la funzione principale da usare per ottenere tutti i valori
 */
export function calculateCompleteNutritionTargets(
  metrics: UserMetrics,
  goal: NutritionGoal,
  dietType: DietType = 'omnivore'
): NutritionTargets {
  // 1. Calcola BMR e TDEE (deterministici)
  const { bmr, tdee } = calculateCalorieNeeds(metrics);

  // 2. Suggerisci calorie target basate sul goal
  const { targetCalories, deficit, surplus } = suggestTargetCalories(tdee, goal);

  // 3. Calcola macro basati su diet type
  const macros = calculateMacrosByDietType(targetCalories, dietType, metrics.weightKg, goal);

  return {
    bmr,
    tdee,
    targetCalories,
    deficit,
    surplus,
    macros,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Converte macro in calorie
 */
export function macrosToCalories(macros: Omit<MacroDistribution, 'calories'>): number {
  return (
    macros.protein * KCAL_PER_GRAM.protein +
    macros.carbs * KCAL_PER_GRAM.carbs +
    macros.fat * KCAL_PER_GRAM.fat
  );
}

/**
 * Calcola le percentuali macro dalle calorie
 */
export function getMacroPercentages(macros: MacroDistribution): {
  protein: number;
  carbs: number;
  fat: number;
} {
  const totalCalories = macrosToCalories(macros);
  return {
    protein: Math.round(((macros.protein * KCAL_PER_GRAM.protein) / totalCalories) * 100),
    carbs: Math.round(((macros.carbs * KCAL_PER_GRAM.carbs) / totalCalories) * 100),
    fat: Math.round(((macros.fat * KCAL_PER_GRAM.fat) / totalCalories) * 100),
  };
}

/**
 * Formatta i target nutrizionali per display
 */
export function formatNutritionTargets(targets: NutritionTargets): string {
  const percentages = getMacroPercentages(targets.macros);

  let result = `BMR: ${targets.bmr} kcal\n`;
  result += `TDEE: ${targets.tdee} kcal\n`;
  result += `Target: ${targets.targetCalories} kcal`;

  if (targets.deficit) {
    result += ` (deficit: ${targets.deficit} kcal)\n`;
  } else if (targets.surplus) {
    result += ` (surplus: ${targets.surplus} kcal)\n`;
  } else {
    result += ` (mantenimento)\n`;
  }

  result += `Proteine: ${targets.macros.protein}g (${percentages.protein}%)\n`;
  result += `Carboidrati: ${targets.macros.carbs}g (${percentages.carbs}%)\n`;
  result += `Grassi: ${targets.macros.fat}g (${percentages.fat}%)`;

  return result;
}
