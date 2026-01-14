/**
 * Nutrition Plan Transform Utilities
 *
 * Clean, refactored version without backward compatibility.
 * Follows KISS, SOLID, DRY principles.
 * FORCE INVALIDATION 123
 */

import { NutritionStatus } from '@onecoach/types';
import { type ZodIssue } from 'zod';
// Type representing a nutrition plan from Prisma database (with JSON fields)
export type PrismaNutritionPlan = {
  id: string;
  name: string;
  description: string | null;
  goals: unknown; // JSON array of strings
  durationWeeks: number;
  targetMacros: unknown; // JSON CompleteMacros
  userProfile: unknown; // JSON NutritionUserProfile | null
  weeks: unknown; // JSON array of NutritionWeek
  restrictions: unknown; // JSON array of strings
  preferences: unknown; // JSON array of strings
  status: NutritionStatus;
  metadata: unknown; // JSON object | null
  personalizedPlan: unknown; // JSON PersonalizedPlan | null
  adaptations: unknown; // JSON Adaptations | null
  createdAt: Date;
  updatedAt: Date;
  version: number;
  userId: string;
};
import type {
  NutritionPlan,
  NutritionWeek,
  NutritionDay,
  Meal,
  Food,
  Macros,
  CompleteMacros,
  MealType,
  PersonalizedPlan,
  Adaptations,
  NutritionUserProfile,
} from '@onecoach/types';
import {
  NutritionWeekSchema,
  NutritionDaySchema,
  MealSchema,
  FoodSchema,
  PersonalizedPlanSchema,
  AdaptationsSchema,
  NutritionPlanBaseSchema,
} from '@onecoach/schemas';
import { createId } from '@onecoach/lib-shared';
import { logger } from '@onecoach/lib-core';
import {
  calculateMacros,
  aggregateMealMacros,
  normalizeMacros,
  normalizeMacroValue,
} from '../utils/macro-calculations';
import {
  parseCompleteMacrosSafe,
  isNutritionWeek,
  isNutritionDay,
  isMeal,
  isFood,
  isPersonalizedPlan,
  isAdaptations,
  isMetadata,
} from './type-guards';

const DEFAULT_MACROS: Macros = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
};

const IS_DEV = process.env.NODE_ENV === 'development';

type RawWeek = Partial<NutritionWeek> & {
  days?: unknown[];
  weeklyAverageMacros?: unknown;
};

type RawDay = Partial<NutritionDay> & {
  meals?: unknown[];
  totalMacros?: unknown;
};

type RawMeal = Partial<Meal> & {
  foods?: unknown[];
  totalMacros?: unknown;
};

type RawFood = Partial<Food> & {
  macros?: unknown;
  actualMacros?: unknown;
};

function normalizePersonalizedPlanValue(value: unknown): PersonalizedPlan | undefined {
  if (!value) return undefined;

  if (isPersonalizedPlan(value)) return value;

  const parsed = PersonalizedPlanSchema.safeParse(value);
  if (!parsed.success) return undefined;

  const maybe = parsed.data as Record<string, unknown>;
  const macroSplit = maybe.macroSplit as Record<string, unknown> | undefined;
  const recommendations = Array.isArray(maybe.recommendations)
    ? maybe.recommendations.filter((r): r is string => typeof r === 'string' && r.length > 0)
    : [];
  const customizations = Array.isArray((maybe as { customizations?: unknown[] }).customizations)
    ? (maybe as { customizations?: unknown[] }).customizations!.filter(
        (r): r is string => typeof r === 'string' && r.length > 0
      )
    : [];
  const personalNotes = Array.isArray((maybe as { personalNotes?: unknown[] }).personalNotes)
    ? (maybe as { personalNotes?: unknown[] }).personalNotes!.filter(
        (r): r is string => typeof r === 'string' && r.length > 0
      )
    : [];
  const mergedRecommendations = [...recommendations, ...customizations, ...personalNotes];

  if (
    typeof maybe.tdee === 'number' &&
    typeof maybe.targetCalories === 'number' &&
    macroSplit &&
    typeof macroSplit.protein === 'number' &&
    typeof macroSplit.carbs === 'number' &&
    typeof macroSplit.fats === 'number'
  ) {
    return {
      tdee: maybe.tdee,
      targetCalories: maybe.targetCalories,
      macroSplit: {
        protein: macroSplit.protein,
        carbs: macroSplit.carbs,
        fats: macroSplit.fats,
      },
      recommendations:
        mergedRecommendations.length > 0 ? mergedRecommendations : ['Personalized plan'],
    };
  }

  // Fallback: build a minimal but type-safe structure
  return {
    tdee: typeof maybe.tdee === 'number' ? maybe.tdee : 0,
    targetCalories: typeof maybe.targetCalories === 'number' ? maybe.targetCalories : 0,
    macroSplit: {
      protein: typeof macroSplit?.protein === 'number' ? (macroSplit.protein as number) : 0,
      carbs: typeof macroSplit?.carbs === 'number' ? (macroSplit.carbs as number) : 0,
      fats: typeof macroSplit?.fats === 'number' ? (macroSplit.fats as number) : 0,
    },
    recommendations:
      mergedRecommendations.length > 0 ? mergedRecommendations : ['Personalized plan'],
  };
}

function normalizeAdaptationsValue(value: unknown): Adaptations | undefined {
  if (!value) {
    return undefined;
  }

  if (isAdaptations(value)) {
    return value as Adaptations;
  }

  const parsed = AdaptationsSchema.safeParse(value);
  return parsed.success ? (parsed.data as Adaptations) : undefined;
}

// ============================================
// TYPE GUARDS & VALIDATORS
// ============================================

function isValidMacros(value: unknown): value is Macros {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  // Accept both numbers and strings (will be normalized in parseMacros)
  return (
    (typeof m.calories === 'number' || typeof m.calories === 'string') &&
    (typeof m.protein === 'number' || typeof m.protein === 'string') &&
    (typeof m.carbs === 'number' || typeof m.carbs === 'string') &&
    (typeof m.fats === 'number' || typeof m.fats === 'string')
  );
}

function isValidGoalsArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((g) => typeof g === 'string');
}

// ============================================
// PARSERS
// ============================================

/**
 * Parse goals - must be non-empty array of strings (validated by Zod schema)
 * No fallback: this function assumes goals have been validated upstream
 */
function parseGoals(goals: unknown): string[] {
  // Must be valid array of strings (validated by Zod schema)
  if (!isValidGoalsArray(goals)) {
    throw new Error('Invalid goals: must be non-empty array of strings (validated by Zod schema)');
  }
  return goals;
}

function parseMacros(value: unknown): Macros {
  if (isValidMacros(value)) {
    // Normalize: ensure all values are numbers (not strings) and round to 2 decimals
    const v = value as Macros & { fiber?: number | string };
    return normalizeMacros({
      calories: typeof v.calories === 'number' ? v.calories : Number(v.calories) || 0,
      protein: typeof v.protein === 'number' ? v.protein : Number(v.protein) || 0,
      carbs: typeof v.carbs === 'number' ? v.carbs : Number(v.carbs) || 0,
      fats: typeof v.fats === 'number' ? v.fats : Number(v.fats) || 0,
      fiber:
        v.fiber !== undefined
          ? typeof v.fiber === 'number'
            ? v.fiber
            : Number(v.fiber) || undefined
          : undefined,
    });
  }
  return { ...DEFAULT_MACROS };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
}

function parseUserProfile(value: unknown): NutritionUserProfile | null {
  if (!value) return null;
  // REMOVED: NutritionUserProfileSchema currently mismatches the NutritionUserProfile type (legacy fields)
  // relying on manual mapping below for correct type shape.
  // const parsed = NutritionUserProfileSchema.safeParse(value);
  // if (parsed.success) return parsed.data;

  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    const asNumber = (val: unknown, fallback: number) =>
      typeof val === 'number' ? val : Number(val) || fallback;
    const sex =
      v.sex === 'male' || v.sex === 'female'
        ? (v.sex as 'male' | 'female')
        : String(v.sex || '').toLowerCase() === 'female'
          ? 'female'
          : 'male';

    return {
      age: asNumber(v.age, 18),
      sex,
      heightCm: asNumber(v.heightCm ?? v.height, 170),
      weightKg: asNumber(v.weightKg ?? v.weight, 70),
      activityLevel:
        v.activityLevel === 'sedentary' ||
        v.activityLevel === 'light' ||
        v.activityLevel === 'moderate' ||
        v.activityLevel === 'active' ||
        v.activityLevel === 'very_active'
          ? (v.activityLevel as NutritionUserProfile['activityLevel'])
          : 'moderate',
      goal: typeof v.goal === 'string' && v.goal.length > 0 ? v.goal : 'maintenance',
    } as NutritionUserProfile;
  }

  return null;
}

/**
 * Parse and validate NutritionStatus from string or enum value
 */
export function parseNutritionStatus(value: unknown): NutritionStatus {
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if (Object.values(NutritionStatus).includes(upper as NutritionStatus)) {
      return upper as NutritionStatus;
    }
  }
  if (value && Object.values(NutritionStatus).includes(value as NutritionStatus)) {
    return value as NutritionStatus;
  }
  // Default to ACTIVE if invalid
  return NutritionStatus.ACTIVE;
}

// ============================================
// NORMALIZERS
// ============================================

export function normalizeNutritionPlan(plan: PrismaNutritionPlan): NutritionPlan {
  try {
    if (IS_DEV) {
      logger.warn('[normalizeNutritionPlan] Starting normalization for plan:', { planId: plan.id });
    }

    const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];

    const normalized = {
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      goals: parseGoals(plan.goals || ['MAINTENANCE']),
      durationWeeks: plan.durationWeeks,
      targetMacros: parseCompleteMacrosSafe(plan.targetMacros),
      userProfile: (parseUserProfile(plan.userProfile) ?? undefined) as
        | NutritionUserProfile
        | undefined,
      weeks: weeks.length > 0 ? weeks.map((w, i) => normalizeWeek(w, i)) : [createEmptyWeek(1)],
      restrictions: parseStringArray(plan.restrictions),
      preferences: parseStringArray(plan.preferences),
      status: plan.status,
      metadata: isMetadata(plan.metadata) ? plan.metadata : null,
      personalizedPlan: normalizePersonalizedPlanValue(plan.personalizedPlan),
      adaptations: normalizeAdaptationsValue(plan.adaptations),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      version: plan.version,
      userId: plan.userId,
    };

    if (IS_DEV) {
      logger.warn('[normalizeNutritionPlan] Normalization complete:', {
        planId: normalized.id,
        weeksCount: normalized.weeks.length,
      });
    }

    return normalized;
  } catch (error: unknown) {
    logger.error('[normalizeNutritionPlan] Error:', error);
    throw error;
  }
}

function normalizeWeek(week: unknown, index: number): NutritionWeek {
  const zodResult = NutritionWeekSchema.safeParse(week);
  if (zodResult.success) {
    return zodResult.data;
  }

  if (isNutritionWeek(week)) {
    return week;
  }

  const rawWeek = week as RawWeek;
  const days = Array.isArray(rawWeek.days) ? rawWeek.days : [];
  const normalizedDays = days.map((d: unknown, i: number) => normalizeDay(d, i));

  let weeklyAverageMacros = rawWeek.weeklyAverageMacros
    ? parseMacros(rawWeek.weeklyAverageMacros)
    : { ...DEFAULT_MACROS };

  if (!rawWeek.weeklyAverageMacros && normalizedDays.length > 0) {
    const totals = normalizedDays.reduce(
      (acc: Macros, day: NutritionDay) => ({
        calories: acc.calories + (day.totalMacros?.calories || 0),
        protein: acc.protein + (day.totalMacros?.protein || 0),
        carbs: acc.carbs + (day.totalMacros?.carbs || 0),
        fats: acc.fats + (day.totalMacros?.fats || 0),
        fiber: (acc.fiber || 0) + (day.totalMacros?.fiber || 0),
      }),
      { ...DEFAULT_MACROS, fiber: 0 }
    );

    weeklyAverageMacros = {
      calories: normalizeMacroValue(totals.calories / normalizedDays.length),
      protein: normalizeMacroValue(totals.protein / normalizedDays.length),
      carbs: normalizeMacroValue(totals.carbs / normalizedDays.length),
      fats: normalizeMacroValue(totals.fats / normalizedDays.length),
      fiber: normalizeMacroValue((totals.fiber || 0) / normalizedDays.length),
    };
  }

  return {
    id: rawWeek.id || createId(),
    weekNumber: rawWeek.weekNumber ?? index + 1,
    days: normalizedDays,
    weeklyAverageMacros,
    notes: rawWeek.notes,
  };
}

function normalizeDay(day: unknown, index: number): NutritionDay {
  const zodResult = NutritionDaySchema.safeParse(day);
  if (zodResult.success) {
    return zodResult.data;
  }

  if (isNutritionDay(day)) {
    return day;
  }

  const rawDay = day as RawDay;
  const meals = Array.isArray(rawDay.meals) ? rawDay.meals : [];
  const normalizedMeals = meals.map((m: unknown, i: number) =>
    normalizeMeal(m, rawDay.dayNumber ?? index + 1, i)
  );

  const totalMacros = rawDay.totalMacros
    ? parseMacros(rawDay.totalMacros)
    : aggregateMealMacros(normalizedMeals);

  return {
    id: rawDay.id || createId(),
    dayNumber: rawDay.dayNumber ?? index + 1,
    dayName: rawDay.dayName || `Day ${index + 1}`,
    meals: normalizedMeals,
    totalMacros,
    notes: rawDay.notes,
  };
}

function normalizeMeal(meal: unknown, _dayNumber: number, index: number): Meal {
  const zodResult = MealSchema.safeParse(meal);
  if (zodResult.success) {
    return zodResult.data;
  }

  if (isMeal(meal)) {
    return meal;
  }

  const rawMeal = meal as RawMeal;
  const foods = Array.isArray(rawMeal.foods) ? rawMeal.foods : [];
  const normalizedFoods = foods.map((f: unknown, _i: number) => normalizeFood(f, createId()));

  const totalMacros = rawMeal.totalMacros
    ? parseMacros(rawMeal.totalMacros)
    : calculateMacros(normalizedFoods);

  return {
    id: rawMeal.id || createId(),
    name: rawMeal.name || `Meal ${index + 1}`,
    type: (rawMeal.type || 'lunch') as MealType,
    time: rawMeal.time,
    foods: normalizedFoods,
    totalMacros,
    notes: rawMeal.notes,
  };
}

/**
 * Normalizza alimento da JSON piano
 * REFACTORED: Richiede foodItemId, non più dati inline
 *
 * ALIAS SUPPORT (per variazioni AI):
 * - foodItemId: itemId, food_item_id, foodId
 * - name: foodName, food_name, displayName
 * - quantity: amount, grams, weight
 * - unit: measurement, measurementUnit
 */
function normalizeFood(food: unknown, fallbackId: string): Food {
  const zodResult = FoodSchema.safeParse(food);
  if (zodResult.success) {
    return zodResult.data;
  }

  if (isFood(food)) {
    return food;
  }

  const rawFood = food as RawFood & {
    // Alias per foodItemId
    itemId?: string;
    food_item_id?: string;
    foodId?: string;
    // Alias per name
    foodName?: string;
    food_name?: string;
    displayName?: string;
    // Alias per quantity
    amount?: number | string;
    grams?: number | string;
    weight?: number | string;
    // Alias per unit
    measurement?: string;
    measurementUnit?: string;
  };

  // Resolve foodItemId con alias
  const foodItemId =
    rawFood.foodItemId ||
    rawFood.itemId ||
    rawFood.food_item_id ||
    rawFood.foodId ||
    rawFood.id ||
    fallbackId;

  // Resolve name con alias
  const name =
    rawFood.name || rawFood.foodName || rawFood.food_name || rawFood.displayName || 'Unknown Food';

  // Resolve quantity con alias
  const rawQuantity = rawFood.quantity ?? rawFood.amount ?? rawFood.grams ?? rawFood.weight;
  const quantity = typeof rawQuantity === 'number' ? rawQuantity : Number(rawQuantity) || 0;

  // Resolve unit con alias
  const unit = rawFood.unit || rawFood.measurement || rawFood.measurementUnit || 'g';

  if (
    !rawFood.foodItemId &&
    !rawFood.itemId &&
    !rawFood.food_item_id &&
    !rawFood.foodId &&
    !rawFood.id &&
    IS_DEV
  ) {
    logger.warn('[normalizeFood] Food without foodItemId, using fallback:', {
      foodData: JSON.stringify(food).substring(0, 100),
      fallbackId,
      resolvedName: name,
    });
  }

  return {
    id: rawFood.id || fallbackId,
    foodItemId,
    quantity,
    unit,
    notes: rawFood.notes,
    macros: rawFood.macros ? parseMacros(rawFood.macros) : undefined,
    name,
    done: rawFood.done,
    actualQuantity: rawFood.actualQuantity,
    actualMacros: rawFood.actualMacros ? parseMacros(rawFood.actualMacros) : undefined,
  };
}

// ============================================
// PERSISTENCE
// ============================================

/**
 * Prepara piano per persistenza
 * REFACTORED: Salva solo foodItemId + quantity (macros calcolati on-demand)
 * TYPE-SAFE: Usa type guards invece di any
 */
export function preparePlanForPersistence(plan: NutritionPlan): {
  name: string;
  description: string;
  goals: string[];
  durationWeeks: number;
  targetMacros: CompleteMacros;
  userProfile: NutritionUserProfile | null;
  personalizedPlan: PersonalizedPlan | null;
  adaptations: Adaptations | null;
  weeks: Array<{
    weekNumber: number;
    notes?: string;
    days: Array<{
      dayNumber: number;
      dayName: string;
      date?: string;
      totalMacros: Macros;
      waterIntake?: number;
      notes?: string;
      meals: Array<{
        id: string;
        name: string;
        type: MealType;
        time?: string;
        notes?: string;
        totalMacros: Macros;
        foods: Array<{
          id: string;
          foodItemId: string;
          quantity: number;
          unit: string;
          notes?: string;
          done?: boolean;
          actualQuantity?: number;
          actualMacros?: Macros;
        }>;
      }>;
    }>;
  }>;
  restrictions: string[];
  preferences: string[];
  status: NutritionStatus;
  metadata: Record<string, unknown> | null;
} {
  return {
    name: plan.name,
    description: plan.description,
    goals: plan.goals,
    durationWeeks: plan.durationWeeks,
    targetMacros: parseCompleteMacrosSafe(plan.targetMacros), // Normalize to ensure numbers and fiber
    userProfile: parseUserProfile(plan.userProfile) ?? null,
    personalizedPlan: plan.personalizedPlan ?? null,
    adaptations: plan.adaptations ?? null,
    weeks: plan.weeks.map((week: NutritionWeek) => ({
      weekNumber: week.weekNumber,
      notes: week.notes,
      days: week.days.map((day: NutritionDay) => ({
        dayNumber: day.dayNumber,
        dayName: day.dayName,
        totalMacros: parseMacros(day.totalMacros),
        notes: day.notes,
        meals: day.meals.map((meal: Meal) => ({
          id: meal.id,
          name: meal.name,
          type: meal.type,
          time: meal.time,
          notes: meal.notes,
          totalMacros: parseMacros(meal.totalMacros), // Normalize to ensure numbers
          foods: meal.foods.map((food: Food) => {
            // SCHEMA VERIFICATION: Log food before persistence
            if (!food.foodItemId) {
              logger.warn('[SCHEMA_VERIFY] Food without foodItemId in preparePlanForPersistence:', {
                foodId: food.id,
                foodName: food.name,
                hasFoodItemId: !!food.foodItemId,
                foodData: JSON.stringify(food).substring(0, 200),
              });
            }
            return {
              id: food.id,
              foodItemId: food.foodItemId,
              name: food.name, // Include name
              macros: food.macros ? parseMacros(food.macros) : undefined, // Include macros snapshot
              quantity:
                typeof food.quantity === 'number' ? food.quantity : Number(food.quantity) || 0,
              unit: food.unit,
              notes: food.notes,
              done: food.done,
              actualQuantity: food.actualQuantity,
              actualMacros: food.actualMacros ? parseMacros(food.actualMacros) : undefined,
              brand: food.brand,
              imageUrl: food.imageUrl,
            };
          }),
        })),
      })),
    })),
    restrictions: plan.restrictions || [],
    preferences: plan.preferences || [],
    status: plan.status,
    metadata: plan.metadata ?? null,
  };
}

// ============================================
// BUILDERS
// ============================================

// ============================================
// BUILDERS
// ============================================

export function createEmptyDay(dayNumber: number): NutritionDay {
  return {
    id: createId(),
    dayNumber,
    dayName: `Day ${dayNumber}`,
    meals: [
      {
        id: createId(),
        name: 'Breakfast',
        type: 'breakfast',
        foods: [],
        totalMacros: { ...DEFAULT_MACROS },
      },
    ],
    totalMacros: { ...DEFAULT_MACROS },
  };
}

export function createEmptyWeek(weekNumber: number): NutritionWeek {
  return {
    id: createId(),
    weekNumber,
    days: Array.from({ length: 7 }, (_, i) => createEmptyDay(i + 1)),
    weeklyAverageMacros: { ...DEFAULT_MACROS },
  };
}

export function createEmptyPlan(userId?: string): NutritionPlan {
  return {
    id: createId(),
    name: 'New Nutrition Plan',
    description: '',
    goals: ['MAINTENANCE'], // Use standard enum value instead of internal key
    durationWeeks: 1,
    targetMacros: { ...DEFAULT_MACROS, fiber: 0 },
    weeks: [createEmptyWeek(1)],
    restrictions: [],
    preferences: [],
    status: NutritionStatus.DRAFT,
    metadata: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: userId || 'temp',
  };
}

// ============================================
// AI PAYLOAD NORMALIZATION
// ============================================

/**
 * Normalize agent payload to NutritionPlan
 * Uses Zod validation for type safety and consistency
 */
export function normalizeAgentPayload(
  payload: unknown,
  base?: Partial<NutritionPlan>
): NutritionPlan {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid agent payload: must be an object');
  }

  const raw = payload as {
    weeks?: unknown[];
    goals?: unknown;
    name?: string;
    description?: string;
    durationWeeks?: number;
    targetMacros?: unknown;
    restrictions?: unknown;
    preferences?: unknown;
  };

  // STRICT: AI deve restituire solo weeks structure (non days flat array)
  let weeks: NutritionWeek[] = [];

  if (Array.isArray(raw.weeks) && raw.weeks.length > 0) {
    // Normalize weeks structure with Zod validation
    weeks = raw.weeks.map((w: unknown, i: number) => {
      const zodResult = NutritionWeekSchema.safeParse(w);
      if (zodResult.success) {
        return zodResult.data;
      }
      // Fallback to manual normalization if Zod fails
      return normalizeWeek(w, i);
    });
  } else {
    throw new Error('Invalid agent payload: must include "weeks" array (STRICT schema)');
  }

  // Normalize goals - handle both array and object formats
  // If goals is an object with a 'goal' field, convert it to an array
  let normalizedGoals: unknown = raw.goals;
  if (raw.goals && typeof raw.goals === 'object' && !Array.isArray(raw.goals)) {
    const goalsObj = raw.goals as { goal?: string; [key: string]: unknown };
    if (goalsObj.goal && typeof goalsObj.goal === 'string') {
      normalizedGoals = [goalsObj.goal];
    }
  }

  // If goals is still not an array, try to use base.goals as fallback
  if (!normalizedGoals || !Array.isArray(normalizedGoals) || normalizedGoals.length === 0) {
    if (base?.goals && Array.isArray(base.goals) && base.goals.length > 0) {
      normalizedGoals = base.goals;
    } else {
      throw new Error(
        'Invalid agent payload: goals must be a non-empty array of strings (validated by Zod schema)'
      );
    }
  }

  if (!base?.userId) {
    throw new Error('userId is required to normalize agent payload');
  }

  const normalizedUserProfile = parseUserProfile(
    (raw as { userProfile?: unknown }).userProfile ?? base?.userProfile
  );

  // Build the plan object
  const planData = {
    id: base?.id ?? createId(),
    name: raw.name || base?.name || 'Nutrition Plan',
    description: raw.description || base?.description || '',
    goals: parseGoals(normalizedGoals),
    durationWeeks: raw.durationWeeks || base?.durationWeeks || 1,
    targetMacros: parseCompleteMacrosSafe(raw.targetMacros || base?.targetMacros),
    weeks: weeks.length > 0 ? weeks : base?.weeks || [createEmptyWeek(1)],
    restrictions: parseStringArray(raw.restrictions || base?.restrictions),
    preferences: parseStringArray(raw.preferences || base?.preferences),
    status: base?.status || NutritionStatus.ACTIVE,
    ...(normalizedUserProfile
      ? { userProfile: normalizedUserProfile as NutritionUserProfile }
      : {}),
    metadata: base?.metadata ?? null,
    createdAt: base?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: base.userId,
    version: base?.version ?? 1,
  };

  // Validate the final plan with Zod schema for type safety
  const validationResult = NutritionPlanBaseSchema.safeParse(planData);
  if (!validationResult.success) {
    logger.error('[normalizeAgentPayload] Validation errors:', validationResult.error.issues);
    throw new Error(
      `Invalid agent payload structure: ${validationResult.error.issues.map((i: ZodIssue) => i.message).join(', ')}`
    );
  }

  return {
    ...validationResult.data,
    createdAt: planData.createdAt,
    updatedAt: planData.updatedAt,
  } as NutritionPlan;
}
