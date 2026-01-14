/**
 * Plan Sync - Pure Functions
 *
 * Funzioni pure per sincronizzare e preparare piani per il salvataggio
 * Segue principi KISS, DRY, SOLID
 */

import type { NutritionPlan, NutritionWeek, NutritionDay, Meal, Food } from '@onecoach/types';
import { calculateMacros, aggregateMealMacros, normalizeMacros } from '../utils/macro-calculations';

/**
 * Sincronizza piano per il salvataggio
 * Normalizza tutti i valori numerici, calcola macro totali, pulisce array
 */
export function syncPlanForSave(planToSync: NutritionPlan): NutritionPlan {
  const syncedWeeks = (planToSync.weeks || []).map((week: NutritionWeek) => {
    const syncedDays = (week.days || []).map((day: NutritionDay) => {
      const meals = day.meals.map((meal: Meal) => {
        const foods = meal.foods.map((food: Food) => ({
          ...food,
          quantity: Number.isFinite(food.quantity) ? Number(food.quantity) : 0,
          unit: food.unit || 'g',
          macros: food.macros
            ? normalizeMacros({
                calories: Number.isFinite(food.macros?.calories) ? Number(food.macros.calories) : 0,
                protein: Number.isFinite(food.macros?.protein) ? Number(food.macros.protein) : 0,
                carbs: Number.isFinite(food.macros?.carbs) ? Number(food.macros.carbs) : 0,
                fats: Number.isFinite(food.macros?.fats) ? Number(food.macros.fats) : 0,
                fiber:
                  food.macros?.fiber !== undefined && Number.isFinite(food.macros.fiber)
                    ? Number(food.macros.fiber)
                    : undefined,
              })
            : { calories: 0, protein: 0, carbs: 0, fats: 0 },
        }));

        const totalMacros = calculateMacros(foods);

        return {
          ...meal,
          foods,
          totalMacros,
        };
      });

      const totalMacros = aggregateMealMacros(meals);

      return {
        ...day,
        meals,
        totalMacros,
      };
    });

    return {
      ...week,
      days: syncedDays,
    };
  });

  return {
    ...planToSync,
    weeks: syncedWeeks,
    restrictions: (planToSync.restrictions ?? []).map((r: string) => r.trim()).filter(Boolean),
    preferences: (planToSync.preferences ?? []).map((p: string) => p.trim()).filter(Boolean),
  };
}
