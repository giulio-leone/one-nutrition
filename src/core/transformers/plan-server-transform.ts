/**
 * Nutrition Plan Server-Side Transform Utilities
 *
 * Functions that require server-only services (database access, etc.)
 * These functions are only executed server-side when called from API routes
 * or server components, even if imported in files that may be used in client components.
 *
 * NOTE: This file does not use 'server-only' because it's imported by context-builder.ts
 * which may be used in client components. The functions themselves are only executed
 * server-side when called.
 */

import type { NutritionPlan, NutritionWeek, NutritionDay, Meal, Food } from '@onecoach/types';
import { FoodService, calculateMacrosFromQuantity } from '@onecoach/lib-food';

import { logger } from '@onecoach/lib-core';
const DEFAULT_MACROS = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
};

/**
 * Risolve foodItemId a dati completi alimenti (batch load)
 * Usato quando serve popolare name e macros per UI/API
 *
 * IMPORTANT: This function is server-only and should only be called from API routes
 */
export async function resolveFoodReferences(plan: NutritionPlan): Promise<NutritionPlan> {
  try {
    logger.warn('[resolveFoodReferences] Starting resolution for plan:', { id: plan.id });

    // Estrai tutti i foodItemId unici dal piano
    const foodItemIds = new Set<string>();
    for (const week of plan.weeks) {
      for (const day of week.days) {
        for (const meal of day.meals) {
          for (const food of meal.foods) {
            if (food.foodItemId) {
              foodItemIds.add(food.foodItemId);
            }
          }
        }
      }
    }

    logger.warn('[resolveFoodReferences] Found foodItemIds:', {
      count: foodItemIds.size,
      ids: Array.from(foodItemIds).slice(0, 10), // Log first 10
    });

    if (foodItemIds.size === 0) {
      logger.warn('[resolveFoodReferences] No foodItemIds found, returning plan as-is');
      return plan;
    }

    // Batch load di tutti gli alimenti
    logger.warn('[resolveFoodReferences] Loading foods from database...');
    const foodItems = await FoodService.getFoodsByIds(Array.from(foodItemIds));
    logger.warn('[resolveFoodReferences] Loaded foods:', {
      requested: foodItemIds.size,
      found: foodItems.length,
    });

    // Type-safe food map
    type FoodItem = {
      id: string;
      name: string;
      macrosPer100g: {
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
        fiber?: number;
      };
    };

    const foodMap = new Map<string, FoodItem>(foodItems.map((f: FoodItem) => [f.id, f]));

    // Popola name e macros per ogni alimento
    logger.warn('[resolveFoodReferences] Resolving food references...');
    const resolvedWeeks = plan.weeks.map((week: NutritionWeek) => ({
      ...week,
      days: week.days.map((day: NutritionDay) => ({
        ...day,
        meals: day.meals.map((meal: Meal) => ({
          ...meal,
          foods: meal.foods.map((food: Food) => {
            const foodItem = food.foodItemId ? foodMap.get(food.foodItemId) : null;

            if (!foodItem) {
              // Se alimento non trovato, mantieni struttura base
              logger.warn('[resolveFoodReferences] Food not found in catalog:', {
                foodItemId: food.foodItemId,
              });
              return {
                ...food,
                name: food.name || 'Unknown Food',
                macros: food.macros || DEFAULT_MACROS,
              };
            }

            // Calcola macros dalla quantità
            const macros = calculateMacrosFromQuantity(
              foodItem.macrosPer100g,
              food.quantity,
              food.unit
            );

            return {
              ...food,
              name: foodItem.name,
              macros,
            };
          }),
        })),
      })),
    }));

    logger.warn('[resolveFoodReferences] Resolution complete');
    return {
      ...plan,
      weeks: resolvedWeeks,
    };
  } catch (error: unknown) {
    logger.error('[resolveFoodReferences] Error resolving food references:', error);
    if (error instanceof Error) {
      logger.error('[resolveFoodReferences] Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    // In caso di errore, ritorna il piano senza risolvere i riferimenti
    // (meglio che fallire completamente)
    logger.warn('[resolveFoodReferences] Returning plan without resolved references due to error');
    return plan;
  }
}
