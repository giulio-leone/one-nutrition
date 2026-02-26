/**
 * Nutrition Tracking Service
 *
 * Service layer for managing nutrition day log tracking.
 * Handles CRUD operations for NutritionDayLog entities.
 *
 * Follows SOLID principles:
 * - Single Responsibility: Only manages nutrition day log data
 * - Open/Closed: Extendable without modification
 * - Dependency Inversion: Depends on Prisma abstraction
 */

import { prisma } from '@giulio-leone/lib-core';
import type {
  NutritionDayLog,
  CreateNutritionDayLogRequest,
  UpdateNutritionDayLogRequest,
  NutritionPlanStats,
  Macros,
  Meal,
} from '@giulio-leone/types';
import { Prisma, type nutrition_day_logs } from '@prisma/client';
import { toMacros, ensureDecimalNumber } from '@giulio-leone/lib-shared';

import { logger } from '@giulio-leone/lib-core';
type NutritionDayLogRecord = nutrition_day_logs;

const db = prisma;

/**
 * Convert database record to domain type
 */
function toNutritionDayLog(record: NutritionDayLogRecord): NutritionDayLog {
  const waterIntakeValue = record.waterIntake;
  const waterIntake =
    waterIntakeValue !== null && waterIntakeValue !== undefined
      ? ensureDecimalNumber(Number(waterIntakeValue))
      : null;
  const actualDailyMacros =
    record.actualDailyMacros !== null && record.actualDailyMacros !== undefined
      ? toMacros(record.actualDailyMacros as Prisma.JsonValue)
      : null;

  return {
    id: record.id,
    userId: record.userId ?? '',
    planId: record.planId,
    weekNumber: record.weekNumber,
    dayNumber: record.dayNumber,
    date: record.date,
    meals: record.meals as Meal[],
    actualDailyMacros,
    waterIntake,
    notes: record.notes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

import { normalizeNutritionPlan, type PrismaNutritionPlan } from '../transformers/plan-transform';

/**
 * Create a new nutrition day log
 *
 * Initializes a log with the meals from the specified plan day.
 * Log starts with all tracking fields empty (to be filled by user).
 */
export async function createNutritionDayLog(
  userId: string,
  request: CreateNutritionDayLogRequest
): Promise<NutritionDayLog> {
  const { planId, weekNumber, dayNumber, date, notes } = request;

  logger.warn('[createNutritionDayLog] Creating log:', {
    planId,
    weekNumber,
    dayNumber,
    date,
  });

  // Fetch the nutrition plan to get the meals for this day
  const rawPlan = await prisma.nutrition_plans.findUnique({
    where: { id: planId },
  });

  if (!rawPlan) {
    throw new Error('Piano nutrizionale non trovato');
  }

  if (rawPlan.userId !== userId) {
    throw new Error('Non hai i permessi per accedere a questo piano');
  }

  // Normalize plan to ensure structure consistency (fixes empty meals issue)
  const plan = normalizeNutritionPlan(rawPlan as PrismaNutritionPlan);

  // Debug: Log plan weeks structure
  logger.warn('[createNutritionDayLog] Plan weeks structure (normalized):', {
    planId: plan.id,
    weeksCount: plan.weeks.length,
    firstWeekDays: plan.weeks[0]?.days?.length ?? 0,
  });

  // Extract meals from the plan's week/day structure using normalized plan
  const week = plan.weeks.find((w: any) => w.weekNumber === weekNumber);
  const day = week?.days.find((d: any) => d.dayNumber === dayNumber);

  if (!day) {
    logger.error('[createNutritionDayLog] Day not found:', {
      weekNumber,
      dayNumber,
      weeksCount: plan.weeks.length,
    });
    throw new Error(`Giorno ${dayNumber} della settimana ${weekNumber} non trovato nel piano`);
  }

  logger.warn('[createNutritionDayLog] Day found:', {
    dayNumber: day.dayNumber,
    dayName: day.dayName,
    mealsCount: day.meals.length,
    firstMealFoods: day.meals[0]?.foods?.length ?? 0,
  });

  const logDate = date || new Date();

  // Check if log already exists for this day
  const existing = await db.nutrition_day_logs.findFirst({
    where: {
      userId,
      planId,
      weekNumber,
      dayNumber,
      date: logDate,
    },
  });

  if (existing) {
    throw new Error('Esiste già un log per questo giorno');
  }

  // Create log with meals (tracking fields will be filled during day)
  const log = await db.nutrition_day_logs.create({
    data: {
      userId,
      planId,
      weekNumber,
      dayNumber,
      date: logDate,
      meals: day.meals as Prisma.InputJsonValue, // Normalized meals are safe
      actualDailyMacros: Prisma.JsonNull,
      notes,
    },
  });

  return toNutritionDayLog(log);
}

/**
 * Get a nutrition day log by ID
 */
export async function getNutritionDayLog(
  logId: string,
  userId: string
): Promise<NutritionDayLog | null> {
  const log = await db.nutrition_day_logs.findUnique({
    where: { id: logId },
  });

  if (!log) {
    return null;
  }

  // Verify ownership
  if (log.userId !== userId) {
    throw new Error('Non hai i permessi per accedere a questo log');
  }

  return toNutritionDayLog(log);
}

/**
 * Get all nutrition day logs for a user
 *
 * @param userId - User ID
 * @param planId - Optional filter by plan ID
 * @param limit - Max number of logs to return
 */
export async function getNutritionDayLogs(
  userId: string,
  planId?: string,
  limit?: number
): Promise<NutritionDayLog[]> {
  const logs = await db.nutrition_day_logs.findMany({
    where: {
      userId,
      ...(planId && { planId }),
    },
    orderBy: {
      date: 'desc',
    },
    ...(limit && { take: limit }),
  });

  return logs.map(toNutritionDayLog);
}

/**
 * Get all logs for a specific nutrition plan
 */
export async function getPlanLogs(planId: string, userId: string): Promise<NutritionDayLog[]> {
  return getNutritionDayLogs(userId, planId);
}

/**
 * Get log for a specific day
 */
export async function getLogForDay(
  userId: string,
  planId: string,
  weekNumber: number,
  dayNumber: number,
  date?: Date
): Promise<NutritionDayLog | null> {
  const queryDate = date || new Date();

  const log = await db.nutrition_day_logs.findFirst({
    where: {
      userId,
      planId,
      weekNumber,
      dayNumber,
      date: queryDate,
    },
  });

  if (!log) {
    return null;
  }

  return toNutritionDayLog(log);
}

/**
 * Update a nutrition day log
 *
 * Typically called during or after meals to update tracking data.
 */
export async function updateNutritionDayLog(
  logId: string,
  userId: string,
  updates: UpdateNutritionDayLogRequest
): Promise<NutritionDayLog> {
  const log = await getNutritionDayLog(logId, userId);

  if (!log) {
    throw new Error('Log non trovato');
  }

  const updated = await db.nutrition_day_logs.update({
    where: { id: logId },
    data: {
      ...(updates.meals && { meals: updates.meals }),
      ...(updates.actualDailyMacros !== undefined && {
        actualDailyMacros:
          updates.actualDailyMacros === null
            ? Prisma.JsonNull
            : (updates.actualDailyMacros as Prisma.InputJsonValue),
      }),
      ...(updates.waterIntake !== undefined && {
        waterIntake: updates.waterIntake !== null ? updates.waterIntake : null,
      }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      updatedAt: new Date(),
    },
  });

  return toNutritionDayLog(updated);
}

/**
 * Delete a nutrition day log
 */
export async function deleteNutritionDayLog(logId: string, userId: string): Promise<void> {
  const log = await getNutritionDayLog(logId, userId);

  if (!log) {
    throw new Error('Log non trovato');
  }

  await db.nutrition_day_logs.delete({
    where: { id: logId },
  });
}

/**
 * Get nutrition plan statistics
 *
 * Calculates adherence rate, average macros, etc. for a plan.
 */
export async function getNutritionPlanStats(
  planId: string,
  userId: string
): Promise<NutritionPlanStats> {
  const plan = await prisma.nutrition_plans.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Piano nutrizionale non trovato');
  }

  if (plan.userId !== userId) {
    throw new Error('Non hai i permessi per accedere a questo piano');
  }

  const logs = await db.nutrition_day_logs.findMany({
    where: {
      planId,
      userId,
    },
  });

  // Use helper function for future-proof access to plan structure
  const { getNutritionPlanTotalDays } = await import('@giulio-leone/lib-shared');
  const { normalizeNutritionPlan: normalizePlanDynamic } =
    await import('../transformers/plan-transform');
  const normalizedPlan = normalizePlanDynamic(plan as PrismaNutritionPlan);
  const totalDays = getNutritionPlanTotalDays(normalizedPlan);

  const loggedDays = logs.length;

  // Calculate average macros from logs with actualDailyMacros
  const logsWithMacros = logs.filter((l: any) => l.actualDailyMacros !== null);
  const totalMacros = logsWithMacros.reduce(
    (acc: { calories: number; protein: number; carbs: number; fats: number }, log) => {
      const macros = toMacros(log.actualDailyMacros as Prisma.JsonValue);
      return {
        calories: acc.calories + (macros?.calories || 0),
        protein: acc.protein + (macros?.protein || 0),
        carbs: acc.carbs + (macros?.carbs || 0),
        fats: acc.fats + (macros?.fats || 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const avgCount = logsWithMacros.length || 1;

  // Calculate average water intake
  const logsWithWater = logs.filter((l: any) => l.waterIntake !== null);
  const totalWater = logsWithWater.reduce(
    (sum: number, log) => sum + Number(log.waterIntake || 0),
    0
  );
  const averageWaterIntake =
    logsWithWater.length > 0 ? totalWater / logsWithWater.length : undefined;

  const sortedLogs = [...logs].sort((a, b) => b.date.getTime() - a.date.getTime());
  const lastLog = sortedLogs[0];

  return {
    planId,
    totalDays,
    loggedDays,
    adherenceRate: totalDays > 0 ? (loggedDays / totalDays) * 100 : 0,
    averageCalories: logsWithMacros.length > 0 ? totalMacros.calories / avgCount : undefined,
    averageProtein: logsWithMacros.length > 0 ? totalMacros.protein / avgCount : undefined,
    averageCarbs: logsWithMacros.length > 0 ? totalMacros.carbs / avgCount : undefined,
    averageFats: logsWithMacros.length > 0 ? totalMacros.fats / avgCount : undefined,
    averageWaterIntake,
    lastLogDate: lastLog?.date,
  };
}

/**
 * Calculate actual daily macros from meals
 *
 * Helper function to sum up macros from all foods in meals.
 * Uses actualMacros if present, otherwise uses planned macros.
 */
export function calculateActualDailyMacros(meals: Array<Record<string, unknown>>): Macros {
  return meals.reduce<Macros>(
    (dailyTotal: Macros, meal: Record<string, unknown>) => {
      const foods = (meal.foods as Array<Record<string, unknown>>) || [];
      const mealMacros = foods.reduce<Macros>(
        (mealTotal, food) => {
          const macros =
            (food.actualMacros as Macros | undefined) || (food.macros as Macros | undefined);
          return {
            calories: mealTotal.calories + (macros?.calories || 0),
            protein: mealTotal.protein + (macros?.protein || 0),
            carbs: mealTotal.carbs + (macros?.carbs || 0),
            fats: mealTotal.fats + (macros?.fats || 0),
            fiber: (mealTotal.fiber || 0) + (macros?.fiber || 0),
          };
        },
        { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
      );

      return {
        calories: dailyTotal.calories + mealMacros.calories,
        protein: dailyTotal.protein + mealMacros.protein,
        carbs: dailyTotal.carbs + mealMacros.carbs,
        fats: dailyTotal.fats + mealMacros.fats,
        fiber: (dailyTotal.fiber || 0) + (mealMacros.fiber || 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
  );
}
