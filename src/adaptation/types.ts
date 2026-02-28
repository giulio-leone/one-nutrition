/**
 * Nutrition Adaptation Pipeline Domain Types
 *
 * Shared types for the nutrition adaptation pipeline.
 * Pure domain types — no runtime dependencies.
 */

// ==================== ADHERENCE ANALYSIS ====================

export interface NutritionAdherenceAnalysis {
  userId: string;
  planId: string;
  periodDays: number;
  macroAdherence: MacroAdherence;
  calorieVariance: CalorieVariance;
  consistencyScore: number; // 0–1
  mealAdherence: MealAdherence[];
  overallAdherence: 'excellent' | 'good' | 'moderate' | 'poor';
}

export interface MacroAdherence {
  proteinAdherence: number; // % of target hit (0–1+)
  carbAdherence: number;
  fatAdherence: number;
  averageProteinG: number;
  averageCarbG: number;
  averageFatG: number;
  targetProteinG: number;
  targetCarbG: number;
  targetFatG: number;
}

export interface CalorieVariance {
  averageCalories: number;
  targetCalories: number;
  variancePercent: number; // positive = over, negative = under
  standardDeviation: number;
  consistentDays: number; // days within ±10% of target
  totalDays: number;
}

export interface MealAdherence {
  mealName: string;
  adherenceRate: number; // 0–1
  averageCalories: number;
  targetCalories: number;
  commonSubstitutions: string[];
  isProblematic: boolean;
}

// ==================== ADAPTATION PLAN ====================

export interface NutritionAdaptationPlan {
  id: string;
  userId: string;
  planId: string;
  analysis: NutritionAdherenceAnalysis;
  adjustments: NutritionAdjustment[];
  mealSwaps: MealSwapSuggestion[];
  status: 'pending' | 'approved' | 'applied' | 'rejected';
  createdAt: string;
}

export type NutritionAdjustmentType =
  | 'calorie_increase'
  | 'calorie_decrease'
  | 'protein_increase'
  | 'carb_adjust'
  | 'fat_adjust'
  | 'meal_timing'
  | 'meal_swap';

export interface NutritionAdjustment {
  type: NutritionAdjustmentType;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  before: string;
  after: string;
}

export interface MealSwapSuggestion {
  mealName: string;
  reason: string;
  currentCalories: number;
  suggestedCalories: number;
  suggestion: string;
}

// ==================== INPUT TYPES (from repos) ====================

/** Minimal daily nutrition log for adherence analysis */
export interface DailyNutritionLog {
  date: string;
  totalCalories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  meals: MealLog[];
}

export interface MealLog {
  mealName: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

/** Nutrition plan targets */
export interface NutritionPlanTargets {
  dailyCalories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  meals: MealTarget[];
}

export interface MealTarget {
  mealName: string;
  calories: number;
}
