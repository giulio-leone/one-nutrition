/**
 * Plan Operations - Pure Functions
 *
 * Funzioni pure per operazioni CRUD su piani nutrizionali
 * Segue principi KISS, DRY, SOLID
 */

import type { NutritionPlan, NutritionWeek, NutritionDay, Meal, Food } from '@giulio-leone/types';
import { createEmptyDay, createEmptyWeek } from '../transformers/plan-transform';
import { getNutritionPlanTotalDays } from '../utils/nutrition-plan-helpers';
import { calculateMacros, recalculateDay } from '../utils/macro-calculations';
import { createId } from '@giulio-leone/lib-shared';

/**
 * Aggiunge una nuova settimana al piano
 */
export function addNutritionWeek(plan: NutritionPlan): { plan: NutritionPlan; weekNumber: number } {
  const totalDays = getNutritionPlanTotalDays(plan);
  const nextWeekNumber = (plan.weeks?.length || 0) + 1;
  const nextDayNumber = totalDays + 1;

  const newWeek: NutritionWeek = {
    id: createId(),
    weekNumber: nextWeekNumber,
    days: [createEmptyDay(nextDayNumber)],
    weeklyAverageMacros: { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 },
    notes: '',
  };

  return {
    plan: {
      ...plan,
      weeks: [...(plan.weeks || []), newWeek],
    },
    weekNumber: nextWeekNumber,
  };
}

/**
 * Rimuove una settimana dal piano e rinumera le rimanenti
 */
export function removeWeek(plan: NutritionPlan, weekNumber: number): NutritionPlan {
  const updatedWeeks = plan.weeks.filter((w: NutritionWeek) => w.weekNumber !== weekNumber);

  // Renumber weeks
  const renumberedWeeks = updatedWeeks.map((week, index) => ({
    ...week,
    weekNumber: index + 1,
  }));

  // Renumber days across all weeks
  let dayCounter = 0;
  const finalWeeks = renumberedWeeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      dayCounter++;
      return {
        ...day,
        dayNumber: dayCounter,
      };
    }),
  }));

  return {
    ...plan,
    weeks: finalWeeks,
  };
}

/**
 * Aggiunge un giorno al piano (aggiunge all'ultima settimana o crea nuova)
 */
export function addDay(plan: NutritionPlan): {
  plan: NutritionPlan;
  weekNumber: number;
  dayNumber: number;
} {
  const totalDays = getNutritionPlanTotalDays(plan);
  const nextDayNumber = totalDays + 1;

  const weeks = [...(plan.weeks || [])];
  if (weeks.length === 0) {
    weeks.push(createEmptyWeek(1));
  } else {
    const lastWeek = weeks[weeks.length - 1];
    if (!lastWeek) {
      weeks.push({
        ...createEmptyWeek(1),
        days: [createEmptyDay(nextDayNumber)],
      });
      return {
        plan: {
          ...plan,
          weeks,
        },
        weekNumber: 1,
        dayNumber: nextDayNumber,
      };
    }
    const daysInLastWeek = lastWeek.days?.length || 0;

    if (daysInLastWeek < 7) {
      // Add to last week
      weeks[weeks.length - 1] = {
        ...lastWeek,
        days: [...(lastWeek.days || []), createEmptyDay(nextDayNumber)],
      };
    } else {
      // Create new week
      weeks.push({
        ...createEmptyWeek(weeks.length + 1),
        days: [createEmptyDay(nextDayNumber)],
      });
    }
  }

  const lastWeekForNumber = weeks[weeks.length - 1];
  if (!lastWeekForNumber) {
    throw new Error('Unexpected: weeks array is empty after processing');
  }
  const weekNumber = lastWeekForNumber.weekNumber;

  return {
    plan: {
      ...plan,
      weeks,
    },
    weekNumber,
    dayNumber: nextDayNumber,
  };
}

/**
 * Rimuove un giorno dal piano e rinumera i giorni rimanenti
 */
export function removeDay(plan: NutritionPlan, dayNumber: number): NutritionPlan {
  // Find and remove the day from weeks structure
  let dayCounter = 0;
  const updatedWeeks = plan.weeks
    .map((week: NutritionWeek) => {
      const filteredDays = (week.days || []).filter(() => {
        dayCounter++;
        return dayCounter !== dayNumber;
      });

      // If week is empty after removal, return null to filter it out
      if (filteredDays.length === 0) {
        return null;
      }

      return {
        ...week,
        days: filteredDays,
      };
    })
    .filter((week): week is NonNullable<typeof week> => week !== null);

  // Renumber days after removal
  let newDayCounter = 0;
  const renumberedWeeks = updatedWeeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      newDayCounter++;
      return {
        ...day,
        dayNumber: newDayCounter,
      };
    }),
  }));

  return {
    ...plan,
    weeks: renumberedWeeks,
  };
}

/**
 * Aggiunge un pasto a un giorno
 */
export function addMeal(
  plan: NutritionPlan,
  dayNumber: number,
  templateMeal?: Meal
): NutritionPlan {
  const timestamp = Date.now();
  const newMeal: Meal = templateMeal
    ? {
        ...templateMeal,
        id: `meal-${timestamp}`,
        foods: templateMeal.foods.map((food: Food) => ({
          ...food,
          id: `food-${timestamp}-${Math.random()}`,
        })),
      }
    : {
        id: `meal-${timestamp}`,
        name: 'Nuovo pasto',
        type: 'lunch',
        foods: [],
        totalMacros: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        notes: '',
      };

  const updatedWeeks = plan.weeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          meals: [...day.meals, newMeal],
        };
      }
      return day;
    }),
  }));

  return {
    ...plan,
    weeks: updatedWeeks,
  };
}

/**
 * Rimuove un pasto da un giorno
 */
export function removeMeal(plan: NutritionPlan, dayNumber: number, mealId: string): NutritionPlan {
  const updatedWeeks = plan.weeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          meals: day.meals.filter((m: Meal) => m.id !== mealId),
        };
      }
      return day;
    }),
  }));

  return {
    ...plan,
    weeks: updatedWeeks,
  };
}

/**
 * Aggiunge un alimento a un pasto
 */
export function addFood(
  plan: NutritionPlan,
  dayNumber: number,
  mealId: string,
  food: Food
): NutritionPlan {
  const updatedWeeks = plan.weeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          meals: day.meals.map((meal: Meal) => {
            if (meal.id === mealId) {
              const updatedFoods = [...meal.foods, food];
              return {
                ...meal,
                foods: updatedFoods,
                totalMacros: calculateMacros(updatedFoods),
              };
            }
            return meal;
          }),
        };
      }
      return day;
    }),
  }));

  return {
    ...plan,
    weeks: updatedWeeks,
  };
}

/**
 * Rimuove un alimento da un pasto
 */
export function removeFood(
  plan: NutritionPlan,
  dayNumber: number,
  mealId: string,
  foodId: string
): NutritionPlan {
  const updatedWeeks = plan.weeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          meals: day.meals.map((meal: Meal) => {
            if (meal.id === mealId) {
              const updatedFoods = meal.foods.filter((food: Food) => food.id !== foodId);
              return {
                ...meal,
                foods: updatedFoods,
                totalMacros: calculateMacros(updatedFoods),
              };
            }
            return meal;
          }),
        };
      }
      return day;
    }),
  }));

  return {
    ...plan,
    weeks: updatedWeeks,
  };
}

/**
 * Aggiorna un alimento in un pasto
 */
export function updateFood(
  plan: NutritionPlan,
  dayNumber: number,
  mealId: string,
  foodId: string,
  updates: Partial<Food>
): NutritionPlan {
  const updatedWeeks = plan.weeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      if (day.dayNumber === dayNumber) {
        // Aggiorna l'alimento nel pasto
        const updatedDay: NutritionDay = {
          ...day,
          meals: day.meals.map((meal: Meal) => {
            if (meal.id === mealId) {
              const updatedFoods = meal.foods.map((food: Food) => {
                if (food.id === foodId) {
                  return { ...food, ...updates };
                }
                return food;
              });
              return {
                ...meal,
                foods: updatedFoods,
                totalMacros: calculateMacros(updatedFoods),
              };
            }
            return meal;
          }),
        };
        // Ricalcola i totalMacros del giorno usando recalculateDay
        return recalculateDay(updatedDay);
      }
      return day;
    }),
  }));

  return {
    ...plan,
    weeks: updatedWeeks,
  };
}

/**
 * Aggiorna un giorno usando un updater function
 */
export function updateDay(
  plan: NutritionPlan,
  dayNumber: number,
  updater: (day: NutritionDay) => NutritionDay
): NutritionPlan {
  const updatedWeeks = plan.weeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      return day.dayNumber === dayNumber ? updater(day) : day;
    }),
  }));

  return {
    ...plan,
    weeks: updatedWeeks,
  };
}

/**
 * Scala proporzionalmente un piano nutrizionale verso un nuovo target calorico.
 * Tutti gli alimenti vengono scalati mantenendo le proporzioni macro originali.
 * I macro target del piano vengono aggiornati di conseguenza.
 */
export function scalePlanToCalories(
  plan: NutritionPlan,
  newTargetCalories: number
): NutritionPlan {
  const currentCalories = plan.targetMacros.calories;
  if (currentCalories <= 0 || newTargetCalories <= 0) {
    return plan;
  }

  const ratio = newTargetCalories / currentCalories;

  const scaledTargetMacros = {
    calories: Math.round(newTargetCalories),
    protein: Math.round(plan.targetMacros.protein * ratio),
    carbs: Math.round(plan.targetMacros.carbs * ratio),
    fats: Math.round(plan.targetMacros.fats * ratio),
    fiber: Math.round(plan.targetMacros.fiber * ratio),
  };

  const scaleFood = (food: Food): Food => {
    if (!food.macros || food.quantity <= 0) return food;
    const scaledQuantity = Math.round(food.quantity * ratio * 10) / 10;
    return {
      ...food,
      quantity: scaledQuantity,
      macros: {
        calories: Math.round((food.macros.calories || 0) * ratio),
        protein: Math.round((food.macros.protein || 0) * ratio * 10) / 10,
        carbs: Math.round((food.macros.carbs || 0) * ratio * 10) / 10,
        fats: Math.round((food.macros.fats || 0) * ratio * 10) / 10,
        fiber: food.macros.fiber != null
          ? Math.round(food.macros.fiber * ratio * 10) / 10
          : undefined,
      },
    };
  };

  const scaledWeeks = plan.weeks.map((week: NutritionWeek) => ({
    ...week,
    days: (week.days || []).map((day: NutritionDay) => {
      const scaledMeals = day.meals.map((meal: Meal) => {
        const scaledFoods = meal.foods.map(scaleFood);
        return {
          ...meal,
          foods: scaledFoods,
          totalMacros: calculateMacros(scaledFoods),
        };
      });
      return recalculateDay({ ...day, meals: scaledMeals });
    }),
    weeklyAverageMacros: week.weeklyAverageMacros
      ? {
          calories: Math.round((week.weeklyAverageMacros.calories || 0) * ratio),
          protein: Math.round((week.weeklyAverageMacros.protein || 0) * ratio * 10) / 10,
          carbs: Math.round((week.weeklyAverageMacros.carbs || 0) * ratio * 10) / 10,
          fats: Math.round((week.weeklyAverageMacros.fats || 0) * ratio * 10) / 10,
          fiber: Math.round((week.weeklyAverageMacros.fiber || 0) * ratio * 10) / 10,
        }
      : week.weeklyAverageMacros,
  }));

  return {
    ...plan,
    targetMacros: scaledTargetMacros,
    weeks: scaledWeeks,
  };
}
