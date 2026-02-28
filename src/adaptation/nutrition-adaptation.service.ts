/**
 * Nutrition Adaptation Service
 *
 * Pure domain service that analyzes nutrition adherence
 * and generates adaptation plans.
 * NO database access — receives all data as parameters.
 */

import type {
  NutritionAdherenceAnalysis,
  NutritionAdaptationPlan,
  NutritionAdjustment,
  MealSwapSuggestion,
  MacroAdherence,
  CalorieVariance,
  MealAdherence,
  DailyNutritionLog,
  NutritionPlanTargets,
} from './types';

// ==================== CONSTANTS ====================

const ADHERENCE_TOLERANCE = 0.1; // ±10% is considered adherent
const EXCELLENT_THRESHOLD = 0.9;
const GOOD_THRESHOLD = 0.75;
const MODERATE_THRESHOLD = 0.5;
const MEAL_PROBLEMATIC_THRESHOLD = 0.5;

// ==================== PUBLIC API ====================

/**
 * Analyze nutrition logs against plan targets.
 * Calculates macro adherence, calorie variance, consistency, and per-meal adherence.
 */
export function analyzeNutritionAdherence(params: {
  userId: string;
  planId: string;
  logs: DailyNutritionLog[];
  targets: NutritionPlanTargets;
}): NutritionAdherenceAnalysis {
  const { userId, planId, logs, targets } = params;

  if (logs.length === 0) {
    return emptyAnalysis(userId, planId);
  }

  const macroAdherence = computeMacroAdherence(logs, targets);
  const calorieVariance = computeCalorieVariance(logs, targets);
  const mealAdherence = computeMealAdherence(logs, targets);
  const consistencyScore = calorieVariance.totalDays > 0
    ? calorieVariance.consistentDays / calorieVariance.totalDays
    : 0;

  const overallAdherence = deriveOverallAdherence(macroAdherence, consistencyScore);

  return {
    userId,
    planId,
    periodDays: logs.length,
    macroAdherence,
    calorieVariance,
    consistencyScore,
    mealAdherence,
    overallAdherence,
  };
}

/**
 * Generate a nutrition adaptation plan based on adherence analysis.
 * Adjusts macros and suggests meal swaps for low-adherence meals.
 */
export function generateNutritionAdaptationPlan(params: {
  userId: string;
  planId: string;
  logs: DailyNutritionLog[];
  targets: NutritionPlanTargets;
}): NutritionAdaptationPlan {
  const analysis = analyzeNutritionAdherence(params);
  const adjustments = generateAdjustments(analysis);
  const mealSwaps = generateMealSwaps(analysis);

  return {
    id: generatePlanId(),
    userId: params.userId,
    planId: params.planId,
    analysis,
    adjustments,
    mealSwaps,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

// ==================== INTERNAL HELPERS ====================

function computeMacroAdherence(
  logs: DailyNutritionLog[],
  targets: NutritionPlanTargets
): MacroAdherence {
  const n = logs.length;
  const avgProtein = logs.reduce((s, l) => s + l.proteinG, 0) / n;
  const avgCarb = logs.reduce((s, l) => s + l.carbG, 0) / n;
  const avgFat = logs.reduce((s, l) => s + l.fatG, 0) / n;

  return {
    proteinAdherence: targets.proteinG > 0 ? avgProtein / targets.proteinG : 0,
    carbAdherence: targets.carbG > 0 ? avgCarb / targets.carbG : 0,
    fatAdherence: targets.fatG > 0 ? avgFat / targets.fatG : 0,
    averageProteinG: round(avgProtein),
    averageCarbG: round(avgCarb),
    averageFatG: round(avgFat),
    targetProteinG: targets.proteinG,
    targetCarbG: targets.carbG,
    targetFatG: targets.fatG,
  };
}

function computeCalorieVariance(
  logs: DailyNutritionLog[],
  targets: NutritionPlanTargets
): CalorieVariance {
  const calories = logs.map((l) => l.totalCalories);
  const n = calories.length;
  const avg = calories.reduce((s, c) => s + c, 0) / n;
  const variancePercent = targets.dailyCalories > 0
    ? ((avg - targets.dailyCalories) / targets.dailyCalories) * 100
    : 0;

  // Standard deviation
  const mean = avg;
  const squaredDiffs = calories.map((c) => (c - mean) ** 2);
  const sd = Math.sqrt(squaredDiffs.reduce((s, d) => s + d, 0) / n);

  // Consistent days (within ±10% of target)
  const lowerBound = targets.dailyCalories * (1 - ADHERENCE_TOLERANCE);
  const upperBound = targets.dailyCalories * (1 + ADHERENCE_TOLERANCE);
  const consistentDays = calories.filter((c) => c >= lowerBound && c <= upperBound).length;

  return {
    averageCalories: round(avg),
    targetCalories: targets.dailyCalories,
    variancePercent: round(variancePercent),
    standardDeviation: round(sd),
    consistentDays,
    totalDays: n,
  };
}

function computeMealAdherence(
  logs: DailyNutritionLog[],
  targets: NutritionPlanTargets
): MealAdherence[] {
  const mealTargetMap = new Map<string, number>();
  for (const mt of targets.meals) {
    mealTargetMap.set(mt.mealName.toLowerCase(), mt.calories);
  }

  // Aggregate per meal name
  const mealAgg = new Map<string, { totalCal: number; count: number; logged: number }>();
  const totalDays = logs.length;

  for (const log of logs) {
    for (const meal of log.meals) {
      const key = meal.mealName.toLowerCase();
      const existing = mealAgg.get(key) ?? { totalCal: 0, count: 0, logged: 0 };
      existing.totalCal += meal.calories;
      existing.count += 1;
      existing.logged += 1;
      mealAgg.set(key, existing);
    }
  }

  const results: MealAdherence[] = [];
  for (const [mealName, targetCal] of mealTargetMap) {
    const agg = mealAgg.get(mealName);
    const adherenceRate = agg ? agg.logged / totalDays : 0;
    const avgCal = agg && agg.count > 0 ? agg.totalCal / agg.count : 0;

    results.push({
      mealName,
      adherenceRate: round(adherenceRate),
      averageCalories: round(avgCal),
      targetCalories: targetCal,
      commonSubstitutions: [],
      isProblematic: adherenceRate < MEAL_PROBLEMATIC_THRESHOLD,
    });
  }

  return results;
}

function generateAdjustments(analysis: NutritionAdherenceAnalysis): NutritionAdjustment[] {
  const adjustments: NutritionAdjustment[] = [];
  const { macroAdherence, calorieVariance } = analysis;

  // Calorie adjustments
  if (Math.abs(calorieVariance.variancePercent) > 15) {
    const direction = calorieVariance.variancePercent > 0 ? 'decrease' : 'increase';
    adjustments.push({
      type: direction === 'increase' ? 'calorie_increase' : 'calorie_decrease',
      priority: 'high',
      reason: `Average calories ${direction === 'increase' ? 'below' : 'above'} target by ${Math.abs(calorieVariance.variancePercent).toFixed(0)}%`,
      before: `${calorieVariance.targetCalories} kcal target`,
      after: `Adjust to ${round(calorieVariance.averageCalories + (calorieVariance.targetCalories - calorieVariance.averageCalories) * 0.5)} kcal (gradual)`,
    });
  } else if (Math.abs(calorieVariance.variancePercent) > 10) {
    const direction = calorieVariance.variancePercent > 0 ? 'decrease' : 'increase';
    adjustments.push({
      type: direction === 'increase' ? 'calorie_increase' : 'calorie_decrease',
      priority: 'medium',
      reason: `Moderate calorie deviation: ${calorieVariance.variancePercent.toFixed(0)}%`,
      before: `${calorieVariance.targetCalories} kcal`,
      after: `Fine-tune by ~${Math.abs(Math.round(calorieVariance.targetCalories - calorieVariance.averageCalories) * 0.3)} kcal`,
    });
  }

  // Protein adherence
  if (macroAdherence.proteinAdherence < 0.85) {
    adjustments.push({
      type: 'protein_increase',
      priority: 'high',
      reason: `Protein intake at ${(macroAdherence.proteinAdherence * 100).toFixed(0)}% of target (${macroAdherence.averageProteinG}g vs ${macroAdherence.targetProteinG}g)`,
      before: `${macroAdherence.targetProteinG}g protein target`,
      after: `Add high-protein foods or adjust meal composition`,
    });
  }

  // Carb adjustments
  if (macroAdherence.carbAdherence < 0.75 || macroAdherence.carbAdherence > 1.25) {
    adjustments.push({
      type: 'carb_adjust',
      priority: 'medium',
      reason: `Carb intake at ${(macroAdherence.carbAdherence * 100).toFixed(0)}% of target`,
      before: `${macroAdherence.targetCarbG}g carb target`,
      after: `Adjust to realistic intake of ~${macroAdherence.averageCarbG.toFixed(0)}g`,
    });
  }

  // Fat adjustments
  if (macroAdherence.fatAdherence < 0.75 || macroAdherence.fatAdherence > 1.25) {
    adjustments.push({
      type: 'fat_adjust',
      priority: 'low',
      reason: `Fat intake at ${(macroAdherence.fatAdherence * 100).toFixed(0)}% of target`,
      before: `${macroAdherence.targetFatG}g fat target`,
      after: `Adjust to realistic intake of ~${macroAdherence.averageFatG.toFixed(0)}g`,
    });
  }

  return adjustments;
}

function generateMealSwaps(analysis: NutritionAdherenceAnalysis): MealSwapSuggestion[] {
  return analysis.mealAdherence
    .filter((m) => m.isProblematic)
    .map((meal) => ({
      mealName: meal.mealName,
      reason: `Low adherence rate: ${(meal.adherenceRate * 100).toFixed(0)}%`,
      currentCalories: meal.averageCalories,
      suggestedCalories: meal.targetCalories,
      suggestion: meal.adherenceRate === 0
        ? `${meal.mealName} is frequently skipped. Consider simpler alternatives or merging with another meal.`
        : `${meal.mealName} has low adherence (${(meal.adherenceRate * 100).toFixed(0)}%). Consider more convenient or preferred alternatives.`,
    }));
}

function deriveOverallAdherence(
  macroAdherence: MacroAdherence,
  consistencyScore: number
): 'excellent' | 'good' | 'moderate' | 'poor' {
  const macroAvg = (
    macroAdherence.proteinAdherence +
    macroAdherence.carbAdherence +
    macroAdherence.fatAdherence
  ) / 3;

  // Clamp adherence values to [0, 1] range for scoring
  const clampedMacro = Math.min(macroAvg, 1);
  const combined = (clampedMacro + consistencyScore) / 2;

  if (combined >= EXCELLENT_THRESHOLD) return 'excellent';
  if (combined >= GOOD_THRESHOLD) return 'good';
  if (combined >= MODERATE_THRESHOLD) return 'moderate';
  return 'poor';
}

function emptyAnalysis(userId: string, planId: string): NutritionAdherenceAnalysis {
  return {
    userId,
    planId,
    periodDays: 0,
    macroAdherence: {
      proteinAdherence: 0,
      carbAdherence: 0,
      fatAdherence: 0,
      averageProteinG: 0,
      averageCarbG: 0,
      averageFatG: 0,
      targetProteinG: 0,
      targetCarbG: 0,
      targetFatG: 0,
    },
    calorieVariance: {
      averageCalories: 0,
      targetCalories: 0,
      variancePercent: 0,
      standardDeviation: 0,
      consistentDays: 0,
      totalDays: 0,
    },
    consistencyScore: 0,
    mealAdherence: [],
    overallAdherence: 'poor',
  };
}

function round(value: number, decimals: number = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function generatePlanId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `nutri_adapt_${timestamp}_${random}`;
}
