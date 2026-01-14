/**
 * Nutrition Generation Transforms
 *
 * Pure TypeScript functions for deterministic operations.
 * These run programmatically, not via AI.
 */

import { nanoid } from 'nanoid';
import type {
  Macros,
  MealTarget,
  NutritionUserProfile,
  NutritionGoals,
  NutritionRestrictions,
  DayPattern,
  PatternCode,
} from '../schema';

// ==================== TYPES ====================

export interface DailyMacros extends Macros {
  fiber: number;
}

export interface CalculateDailyMacrosInput {
  userProfile: NutritionUserProfile;
  goals: NutritionGoals;
}

export interface DistributeMealMacrosInput {
  dailyMacros: DailyMacros;
  mealsPerDay: number;
}

export interface AssemblePlanInput {
  patterns: DayPattern[];
  dailyMacros: DailyMacros;
  mealTargets: MealTarget[];
  userProfile: NutritionUserProfile;
  goals: NutritionGoals;
  restrictions: NutritionRestrictions;
  userId: string;
}

// ==================== CALCULATE DAILY MACROS ====================

/**
 * Calculate daily macros using Mifflin-St Jeor equation
 */
export function calculateDailyMacros(input: CalculateDailyMacrosInput): DailyMacros {
  const { userProfile, goals } = input;
  const { weight, height, age, gender, activityLevel } = userProfile;
  const { goal } = goals;

  // Mifflin-St Jeor BMR
  const bmr =
    gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  // Activity multipliers
  const activityMultipliers: Record<string, number> = {
    SEDENTARY: 1.2,
    LIGHT: 1.375,
    MODERATE: 1.55,
    VERY_ACTIVE: 1.725,
    EXTRA_ACTIVE: 1.9,
  };
  const tdee = bmr * (activityMultipliers[activityLevel] ?? 1.55);

  // Goal adjustments
  const goalAdjustments: Record<string, number> = {
    weight_loss: -500,
    muscle_gain: 300,
    maintenance: 0,
    performance: 200,
  };
  const targetCalories = Math.round(tdee + (goalAdjustments[goal] ?? 0));

  // Macro distribution based on goal
  let proteinRatio = 0.25;
  let carbRatio = 0.45;
  let fatRatio = 0.3;

  if (goal === 'muscle_gain' || goal === 'performance') {
    proteinRatio = 0.3;
    carbRatio = 0.45;
    fatRatio = 0.25;
  } else if (goal === 'weight_loss') {
    proteinRatio = 0.35;
    carbRatio = 0.35;
    fatRatio = 0.3;
  }

  return {
    calories: targetCalories,
    protein: Math.round((targetCalories * proteinRatio) / 4),
    carbs: Math.round((targetCalories * carbRatio) / 4),
    fats: Math.round((targetCalories * fatRatio) / 9),
    fiber: 30,
  };
}

// ==================== DISTRIBUTE MEAL MACROS ====================

interface MealConfig {
  type: MealTarget['type'];
  name: string;
  pct: number;
  time: string;
}

/**
 * Distribute daily macros across meals
 */
export function distributeMealMacros(input: DistributeMealMacrosInput): MealTarget[] {
  const { dailyMacros, mealsPerDay } = input;

  // Standard Italian meal structure
  const mealConfigs: Record<number, MealConfig[]> = {
    3: [
      { type: 'breakfast', name: 'Colazione', pct: 25, time: '07:30' },
      { type: 'lunch', name: 'Pranzo', pct: 40, time: '12:30' },
      { type: 'dinner', name: 'Cena', pct: 35, time: '19:30' },
    ],
    4: [
      { type: 'breakfast', name: 'Colazione', pct: 20, time: '07:30' },
      { type: 'lunch', name: 'Pranzo', pct: 35, time: '12:30' },
      { type: 'snack', name: 'Spuntino', pct: 10, time: '16:00' },
      { type: 'dinner', name: 'Cena', pct: 35, time: '19:30' },
    ],
    5: [
      { type: 'breakfast', name: 'Colazione', pct: 20, time: '07:30' },
      { type: 'snack', name: 'Spuntino Mattina', pct: 10, time: '10:00' },
      { type: 'lunch', name: 'Pranzo', pct: 30, time: '12:30' },
      { type: 'snack', name: 'Spuntino Pomeriggio', pct: 10, time: '16:00' },
      { type: 'dinner', name: 'Cena', pct: 30, time: '19:30' },
    ],
    6: [
      { type: 'breakfast', name: 'Colazione', pct: 15, time: '07:30' },
      { type: 'snack', name: 'Spuntino Mattina', pct: 10, time: '10:00' },
      { type: 'lunch', name: 'Pranzo', pct: 25, time: '12:30' },
      { type: 'snack', name: 'Spuntino Pomeriggio', pct: 10, time: '16:00' },
      { type: 'dinner', name: 'Cena', pct: 25, time: '19:30' },
      { type: 'snack', name: 'Spuntino Serale', pct: 15, time: '21:00' },
    ],
  };

  const config = mealConfigs[mealsPerDay] ?? mealConfigs[5]!;

  return config.map((meal) => ({
    type: meal.type,
    name: meal.name,
    time: meal.time,
    caloriePercentage: meal.pct,
    targetMacros: {
      calories: Math.round(dailyMacros.calories * (meal.pct / 100)),
      protein: Math.round(dailyMacros.protein * (meal.pct / 100)),
      carbs: Math.round(dailyMacros.carbs * (meal.pct / 100)),
      fats: Math.round(dailyMacros.fats * (meal.pct / 100)),
    },
  }));
}

// ==================== ASSEMBLE PLAN ====================

/**
 * Assemble final nutrition plan from composed patterns
 */
export function assemblePlan(input: AssemblePlanInput) {
  const {
    patterns,
    dailyMacros,
    mealTargets: _mealTargets,
    userProfile,
    goals,
    restrictions,
    userId,
  } = input;
  const now = new Date().toISOString();
  const planId = nanoid();

  // Build weekly rotation from pattern codes
  const patternCodes = patterns.map((p) => p.patternCode);
  const weeklyRotation: PatternCode[] = [];
  for (let i = 0; i < 7; i++) {
    weeklyRotation.push(patternCodes[i % patternCodes.length]!);
  }

  // Build weeks
  const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  const weeks = [];

  for (let weekNum = 1; weekNum <= goals.durationWeeks; weekNum++) {
    const days = weeklyRotation.map((patternCode, dayIndex) => {
      const pattern = patterns.find((p) => p.patternCode === patternCode);
      const meals =
        pattern?.meals?.map((meal) => ({
          id: meal.id || nanoid(),
          name: meal.name,
          type: meal.type,
          time: meal.time,
          foods:
            meal.foods?.map((food) => ({
              id: food.id || nanoid(),
              foodItemId: food.foodItemId,
              name: food.name,
              quantity: food.quantity,
              unit: food.unit || 'g',
              macros: food.macros,
            })) || [],
          totalMacros: meal.totalMacros || { calories: 0, protein: 0, carbs: 0, fats: 0 },
        })) || [];

      const totalMacros = meals.reduce(
        (acc, meal) => ({
          calories: acc.calories + (meal.totalMacros?.calories || 0),
          protein: acc.protein + (meal.totalMacros?.protein || 0),
          carbs: acc.carbs + (meal.totalMacros?.carbs || 0),
          fats: acc.fats + (meal.totalMacros?.fats || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      return {
        id: nanoid(),
        dayNumber: (weekNum - 1) * 7 + dayIndex + 1,
        dayName: dayNames[dayIndex % 7] ?? 'Giorno',
        patternCode,
        patternId: pattern?.id ?? '',
        meals,
        totalMacros,
        appliedVariants: [] as Array<{ mealId: string; swapIndex: number }>,
        isCustomized: false,
      };
    });

    weeks.push({
      id: nanoid(),
      weekNumber: weekNum,
      days,
      weeklyAverageMacros: dailyMacros,
    });
  }

  // Count unique foods
  const foodIds = new Set<string>();
  patterns.forEach((pattern) => {
    pattern.meals.forEach((meal) => {
      meal.foods.forEach((food) => {
        foodIds.add(food.foodItemId);
      });
    });
  });

  return {
    id: planId,
    userId,
    name: `Piano ${goals.goal} - ${goals.durationWeeks} settimane`,
    description: `Piano nutrizionale personalizzato con ${patterns.length} pattern giornalieri`,
    goals: [goals.goal],
    durationWeeks: goals.durationWeeks,
    targetMacros: dailyMacros,
    selectedFoodIds: [],
    dayPatterns: patterns,
    weeklyRotation,
    weeks,
    restrictions: [
      ...(restrictions.allergies || []),
      ...(restrictions.intolerances || []),
      restrictions.dietType,
    ].filter(Boolean),
    preferences: restrictions.preferredFoods || [],
    status: 'ACTIVE',
    version: 1,
    userProfile: {
      weight: userProfile.weight,
      height: userProfile.height,
      age: userProfile.age,
      gender: userProfile.gender,
      activityLevel: userProfile.activityLevel,
    },
    generationMetadata: {
      method: 'pattern_based',
      patternsCount: patterns.length,
      selectedFoodsCount: foodIds.size,
      totalVariants: 0,
      generatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== EXPORTS ====================

export const nutritionTransforms = {
  calculateDailyMacros,
  distributeMealMacros,
  assemblePlan,
};
