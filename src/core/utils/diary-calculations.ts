import type { Macros } from '../utils/macro-calculations';
import {
  calculateMacros,
  aggregateMealMacros,
  normalizeMacros,
  normalizeMacroValue,
} from '../utils/macro-calculations';

export interface DiaryFood {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  macros: Macros;
}

export interface DiaryMeal {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre-workout' | 'post-workout';
  time?: string;
  foods: DiaryFood[];
  status: 'pending' | 'done' | 'skipped';
}

export interface MacroTarget {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * Calculate consumed macros from diary meals (excludes skipped meals).
 */
export function calculateConsumedMacros(meals: DiaryMeal[]): MacroTarget {
  const active = meals.filter((m) => m.status !== 'skipped');
  return {
    calories: active.reduce((s, m) => s + m.foods.reduce((fs, f) => fs + (f.macros?.calories || 0), 0), 0),
    protein: active.reduce((s, m) => s + m.foods.reduce((fs, f) => fs + (f.macros?.protein || 0), 0), 0),
    carbs: active.reduce((s, m) => s + m.foods.reduce((fs, f) => fs + (f.macros?.carbs || 0), 0), 0),
    fats: active.reduce((s, m) => s + m.foods.reduce((fs, f) => fs + (f.macros?.fats || 0), 0), 0),
  };
}

/**
 * Calculate adherence percentage (done / total meals * 100).
 */
export function calculateAdherence(meals: DiaryMeal[]): number {
  if (meals.length === 0) return 0;
  const done = meals.filter((m) => m.status === 'done').length;
  return Math.round((done / meals.length) * 100);
}

/**
 * Calculate remaining macros (target - consumed, min 0).
 */
export function calculateRemaining(consumed: MacroTarget, target: MacroTarget): MacroTarget {
  return {
    calories: Math.max(0, target.calories - consumed.calories),
    protein: Math.max(0, target.protein - consumed.protein),
    carbs: Math.max(0, target.carbs - consumed.carbs),
    fats: Math.max(0, target.fats - consumed.fats),
  };
}

/**
 * Check if consumed exceeds target for any macro.
 */
export function isOverTarget(consumed: MacroTarget, target: MacroTarget): Record<keyof MacroTarget, boolean> {
  return {
    calories: consumed.calories > target.calories,
    protein: consumed.protein > target.protein,
    carbs: consumed.carbs > target.carbs,
    fats: consumed.fats > target.fats,
  };
}
