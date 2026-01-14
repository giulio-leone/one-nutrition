/**
 * Template Helpers - Pure Functions
 *
 * Helper per gestione template (estrazione dati, re-ID, etc.)
 * Segue principi KISS, DRY, SOLID
 */

import type {
  NutritionTemplate,
  NutritionTemplateType,
  Meal,
  NutritionDay,
  NutritionWeek,
  Food,
} from '@onecoach/types';

/**
 * Estrae dati template in base al tipo
 */
export function extractTemplateData(
  template: NutritionTemplate
): Meal | NutritionDay | NutritionWeek {
  return template.data;
}

/**
 * Re-ID tutti i pasti e alimenti in un template per evitare conflitti
 */
export function reIdTemplateData<T extends Meal | NutritionDay | NutritionWeek>(
  data: T,
  type: NutritionTemplateType
): T {
  const timestamp = Date.now();

  switch (type) {
    case 'meal': {
      const meal = data as Meal;
      return {
        ...meal,
        id: `meal-${timestamp}-${Math.random()}`,
        foods: meal.foods.map((food: Food) => ({
          ...food,
          id: `food-${timestamp}-${Math.random()}`,
        })),
      } as T;
    }

    case 'day': {
      const day = data as NutritionDay;
      return {
        ...day,
        meals: day.meals.map((meal: Meal) => ({
          ...meal,
          id: `meal-${timestamp}-${Math.random()}`,
          foods: meal.foods.map((food: Food) => ({
            ...food,
            id: `food-${timestamp}-${Math.random()}`,
          })),
        })),
      } as T;
    }

    case 'week': {
      const week = data as NutritionWeek;
      return {
        ...week,
        days: week.days.map((day: NutritionDay) => ({
          ...day,
          meals: day.meals.map((meal: Meal) => ({
            ...meal,
            id: `meal-${timestamp}-${Math.random()}`,
            foods: meal.foods.map((food: Food) => ({
              ...food,
              id: `food-${timestamp}-${Math.random()}`,
            })),
          })),
        })),
      } as T;
    }

    default:
      return data;
  }
}
