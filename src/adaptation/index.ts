/**
 * Nutrition Adaptation Module
 *
 * AI adaptation pipeline for nutrition plans.
 * Pure domain services — no database dependencies.
 */

// Domain types
export type {
  NutritionAdherenceAnalysis,
  MacroAdherence,
  CalorieVariance,
  MealAdherence,
  NutritionAdaptationPlan,
  NutritionAdjustmentType,
  NutritionAdjustment,
  MealSwapSuggestion,
  DailyNutritionLog,
  MealLog,
  NutritionPlanTargets,
  MealTarget,
} from './types';

// Nutrition adaptation services (pure functions)
export {
  analyzeNutritionAdherence,
  generateNutritionAdaptationPlan,
} from './nutrition-adaptation.service';
