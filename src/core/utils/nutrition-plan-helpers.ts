/**
 * Nutrition Plan Helper Utilities
 *
 * Future-proof utility functions for accessing NutritionPlan data.
 * Centralizes access patterns to avoid schema inconsistencies.
 * Part of Nutrition Core.
 */

import type { NutritionPlan, NutritionWeek, NutritionDay } from '@giulio-leone/types';

/**
 * Get all goals from a nutrition plan
 */
export function getNutritionPlanGoals(plan: NutritionPlan): string[] {
  return plan.goals || [];
}

/**
 * Get first goal (for display purposes)
 */
export function getNutritionPlanFirstGoal(plan: NutritionPlan): string | null {
  return plan.goals && plan.goals.length > 0 ? (plan.goals[0] ?? null) : null;
}

/**
 * Get all days from a nutrition plan (flattened from weeks)
 */
export function getAllNutritionPlanDays(plan: NutritionPlan): NutritionDay[] {
  if (!plan.weeks || plan.weeks.length === 0) {
    return [];
  }
  return plan.weeks.flatMap((week) => week.days || []);
}

/**
 * Get total number of days in a nutrition plan
 */
export function getNutritionPlanTotalDays(plan: NutritionPlan): number {
  return getAllNutritionPlanDays(plan).length;
}

/**
 * Get a specific day by day number (1-based)
 */
export function getNutritionPlanDay(plan: NutritionPlan, dayNumber: number): NutritionDay | null {
  const days = getAllNutritionPlanDays(plan);
  return days.find((d) => d.dayNumber === dayNumber) || null;
}

/**
 * Get a specific day by week and day number
 */
export function getNutritionPlanDayByWeek(
  plan: NutritionPlan,
  weekNumber: number,
  dayNumber: number
): NutritionDay | null {
  const week = plan.weeks?.find((w) => w.weekNumber === weekNumber);
  if (!week) {
    return null;
  }
  return week.days?.find((d) => d.dayNumber === dayNumber) || null;
}

/**
 * Get week by week number
 */
export function getNutritionPlanWeek(
  plan: NutritionPlan,
  weekNumber: number
): NutritionWeek | null {
  return plan.weeks?.find((w) => w.weekNumber === weekNumber) || null;
}

/**
 * Iterate over all weeks in a plan
 */
export function* iterateNutritionPlanWeeks(plan: NutritionPlan): Generator<NutritionWeek> {
  if (!plan.weeks) {
    return;
  }
  for (const week of plan.weeks) {
    yield week;
  }
}

/**
 * Iterate over all days in a plan (across all weeks)
 */
export function* iterateNutritionPlanDays(plan: NutritionPlan): Generator<NutritionDay> {
  if (!plan.weeks) {
    return;
  }
  for (const week of plan.weeks) {
    if (week.days) {
      for (const day of week.days) {
        yield day;
      }
    }
  }
}

/**
 * Determine week and day number from date
 *
 * Calculates which day of the nutrition plan should be displayed based on the target date.
 * The plan cycles through all days, repeating from the beginning when the cycle completes.
 */
export function getWeekAndDayFromDate(
  plan: NutritionPlan,
  targetDate: Date
): { weekNumber: number; dayNumber: number } | null {
  if (!plan.weeks || plan.weeks.length === 0) return null;

  const daysFromStart = Math.floor(
    (targetDate.getTime() - new Date(plan.createdAt || Date.now()).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const totalDays = plan.weeks.reduce((total: number, week) => total + (week.days?.length || 0), 0);

  if (totalDays === 0) {
    const firstWeek = plan.weeks[0];
    if (!firstWeek) return null;
    const firstDay = firstWeek.days?.[0];
    return {
      weekNumber: firstWeek.weekNumber,
      dayNumber: firstDay?.dayNumber || 1,
    };
  }

  const dayIndex = ((daysFromStart % totalDays) + totalDays) % totalDays;

  let currentDayIndex = 0;
  for (const week of plan.weeks) {
    for (const day of week.days || []) {
      if (currentDayIndex === dayIndex) {
        return {
          weekNumber: week.weekNumber,
          dayNumber: day.dayNumber,
        };
      }
      currentDayIndex++;
    }
  }

  const firstWeek = plan.weeks[0];
  if (!firstWeek) return null;
  const firstDay = firstWeek.days?.[0];
  return {
    weekNumber: firstWeek.weekNumber,
    dayNumber: firstDay?.dayNumber || 1,
  };
}

/**
 * Deep clone a value
 */
export function deepClone<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (val instanceof Date) return new Date(val.getTime()) as any;
  if (Array.isArray(val)) return val.map(deepClone) as any;
  const res: any = {};
  for (const key in val) {
    if (Object.prototype.hasOwnProperty.call(val, key)) {
      res[key] = deepClone((val as any)[key]);
    }
  }
  return res;
}
