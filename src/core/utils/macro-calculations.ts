/**
 * Macro Calculations
 *
 * Unified utility functions for calculating and manipulating nutritional macros.
 * Part of Nutrition Core.
 */

import type { Food, Meal, NutritionDay } from '@onecoach/types';

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
}

/**
 * Normalize macro value to 2 decimal places
 * Global utility to ensure consistency across the application
 */
export function normalizeMacroValue(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normalize all macro values in a Macros object to 2 decimal places
 */
export function normalizeMacros(macros: Macros): Macros {
  return {
    calories: normalizeMacroValue(macros.calories),
    protein: normalizeMacroValue(macros.protein),
    carbs: normalizeMacroValue(macros.carbs),
    fats: normalizeMacroValue(macros.fats),
    fiber: macros.fiber !== undefined ? normalizeMacroValue(macros.fiber) : undefined,
  };
}

/**
 * Calculate total macros from an array of foods
 */
export function calculateMacros(foods: Food[]): Macros {
  const result = foods.reduce(
    (acc: Macros, food: Food) => ({
      calories: acc.calories + (food.macros?.calories || 0),
      protein: acc.protein + (food.macros?.protein || 0),
      carbs: acc.carbs + (food.macros?.carbs || 0),
      fats: acc.fats + (food.macros?.fats || 0),
      fiber: (acc.fiber || 0) + (food.macros?.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
  );
  return normalizeMacros(result);
}

/**
 * Aggregate macros from an array of meals
 */
export function aggregateMealMacros(meals: Meal[]): Macros {
  const result = meals.reduce(
    (acc: Macros, meal: Meal) => ({
      calories: acc.calories + (meal.totalMacros?.calories || 0),
      protein: acc.protein + (meal.totalMacros?.protein || 0),
      carbs: acc.carbs + (meal.totalMacros?.carbs || 0),
      fats: acc.fats + (meal.totalMacros?.fats || 0),
      fiber: (acc.fiber || 0) + (meal.totalMacros?.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
  );
  return normalizeMacros(result);
}

/**
 * Recalculate food macros proportionally when quantity changes
 */
export function recalculateFoodMacros(
  food: Food,
  oldQuantity: number,
  newQuantity: number
): Macros {
  if (!food.macros) {
    return { calories: 0, protein: 0, carbs: 0, fats: 0 };
  }

  if (oldQuantity === 0 || newQuantity === 0) {
    return food.macros;
  }

  const ratio = newQuantity / oldQuantity;
  const baseMacros = food.macros;

  return normalizeMacros({
    calories: (baseMacros?.calories || 0) * ratio,
    protein: (baseMacros?.protein || 0) * ratio,
    carbs: (baseMacros?.carbs || 0) * ratio,
    fats: (baseMacros?.fats || 0) * ratio,
    fiber: baseMacros?.fiber ? baseMacros.fiber * ratio : undefined,
  });
}

/**
 * Recalculate day macros (useful after modifications)
 */
export function recalculateDay(day: NutritionDay): NutritionDay {
  const meals = day.meals.map((meal: Meal) => ({
    ...meal,
    totalMacros: calculateMacros(meal.foods),
  }));

  return {
    ...day,
    meals,
    totalMacros: aggregateMealMacros(meals),
  };
}

/**
 * Calculate calories from macros (validation)
 * Protein: 4 kcal/g, Carbs: 4 kcal/g, Fats: 9 kcal/g
 */
export function calculateCaloriesFromMacros(protein: number, carbs: number, fats: number): number {
  return normalizeMacroValue(protein * 4 + carbs * 4 + fats * 9);
}
