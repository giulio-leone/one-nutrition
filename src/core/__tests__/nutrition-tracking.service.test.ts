import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceRegistry, REPO_TOKENS } from '@giulio-leone/core';

// Mock the plan-transform module so we don't depend on Zod schemas at runtime
vi.mock('../transformers/plan-transform', () => ({
  normalizeNutritionPlan: vi.fn((plan: unknown) => plan),
  PrismaNutritionPlan: {},
}));

// Mock dynamic import of @giulio-leone/lib-shared used in getNutritionPlanStats
vi.mock('@giulio-leone/lib-shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getNutritionPlanTotalDays: vi.fn((plan: { weeks: { days: unknown[] }[] }) =>
      plan.weeks.reduce((sum: number, w: { days: unknown[] }) => sum + w.days.length, 0)
    ),
  };
});

import {
  createNutritionDayLog,
  getNutritionDayLog,
  getNutritionDayLogs,
  getPlanLogs,
  getLogForDay,
  updateNutritionDayLog,
  deleteNutritionDayLog,
  getNutritionPlanStats,
  calculateActualDailyMacros,
} from '../services/nutrition-tracking.service';

// ── Helpers ──────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const PLAN_ID = 'plan-1';
const LOG_ID = 'log-1';
const NOW = new Date('2024-06-01T10:00:00Z');

function makeMeal(overrides = {}) {
  return {
    id: 'meal-1',
    name: 'Breakfast',
    type: 'breakfast',
    foods: [
      {
        id: 'food-1',
        foodItemId: 'fi-1',
        name: 'Chicken',
        quantity: 100,
        unit: 'g',
        macros: { calories: 165, protein: 31, carbs: 0, fats: 3.6 },
      },
    ],
    totalMacros: { calories: 165, protein: 31, carbs: 0, fats: 3.6 },
    ...overrides,
  };
}

function makeDbLog(overrides: Record<string, unknown> = {}) {
  return {
    id: LOG_ID,
    userId: USER_ID,
    planId: PLAN_ID,
    weekNumber: 1,
    dayNumber: 1,
    date: NOW,
    meals: [makeMeal()],
    actualDailyMacros: null,
    waterIntake: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePlanRecord() {
  return {
    id: PLAN_ID,
    userId: USER_ID,
    name: 'Test Plan',
    weeks: [
      {
        weekNumber: 1,
        days: [
          {
            dayNumber: 1,
            dayName: 'Monday',
            meals: [makeMeal()],
            totalMacros: { calories: 165, protein: 31, carbs: 0, fats: 3.6 },
          },
        ],
      },
    ],
  };
}

// ── Mock repos ───────────────────────────────────────────────────────

function createMockDayLogRepo() {
  return {
    findById: vi.fn(),
    findByUser: vi.fn(),
    findForDay: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockPlanRepo() {
  return {
    findById: vi.fn(),
    findByUser: vi.fn(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('nutrition-tracking.service', () => {
  let dayLogRepo: ReturnType<typeof createMockDayLogRepo>;
  let planRepo: ReturnType<typeof createMockPlanRepo>;

  beforeEach(() => {
    dayLogRepo = createMockDayLogRepo();
    planRepo = createMockPlanRepo();
    ServiceRegistry.__setMock(REPO_TOKENS.NUTRITION_DAY_LOG, dayLogRepo);
    ServiceRegistry.__setMock(REPO_TOKENS.NUTRITION, planRepo);
  });

  afterEach(() => {
    ServiceRegistry.__clearAll();
    vi.restoreAllMocks();
  });

  // ── createNutritionDayLog ─────────────────────────────────────────

  describe('createNutritionDayLog', () => {
    it('creates a log when plan exists and no duplicate', async () => {
      const plan = makePlanRecord();
      planRepo.findById.mockResolvedValue(plan);
      dayLogRepo.findForDay.mockResolvedValue(null);
      dayLogRepo.create.mockResolvedValue(makeDbLog());

      const result = await createNutritionDayLog(USER_ID, {
        planId: PLAN_ID,
        weekNumber: 1,
        dayNumber: 1,
        date: NOW,
      });

      expect(result.id).toBe(LOG_ID);
      expect(result.planId).toBe(PLAN_ID);
      expect(result.userId).toBe(USER_ID);
      expect(dayLogRepo.create).toHaveBeenCalledOnce();
    });

    it('throws when plan is not found', async () => {
      planRepo.findById.mockResolvedValue(null);

      await expect(
        createNutritionDayLog(USER_ID, { planId: PLAN_ID, weekNumber: 1, dayNumber: 1 })
      ).rejects.toThrow('Piano nutrizionale non trovato');
    });

    it('throws when user does not own the plan', async () => {
      planRepo.findById.mockResolvedValue({ ...makePlanRecord(), userId: 'other-user' });

      await expect(
        createNutritionDayLog(USER_ID, { planId: PLAN_ID, weekNumber: 1, dayNumber: 1 })
      ).rejects.toThrow('Non hai i permessi');
    });

    it('throws when day not found in plan weeks', async () => {
      planRepo.findById.mockResolvedValue(makePlanRecord());
      // week 1, day 99 does not exist
      await expect(
        createNutritionDayLog(USER_ID, { planId: PLAN_ID, weekNumber: 1, dayNumber: 99 })
      ).rejects.toThrow('non trovato nel piano');
    });

    it('throws when log already exists for that day', async () => {
      planRepo.findById.mockResolvedValue(makePlanRecord());
      dayLogRepo.findForDay.mockResolvedValue(makeDbLog());

      await expect(
        createNutritionDayLog(USER_ID, { planId: PLAN_ID, weekNumber: 1, dayNumber: 1, date: NOW })
      ).rejects.toThrow('Esiste già un log per questo giorno');
    });
  });

  // ── getNutritionDayLog ────────────────────────────────────────────

  describe('getNutritionDayLog', () => {
    it('returns the log when found and user matches', async () => {
      dayLogRepo.findById.mockResolvedValue(makeDbLog());

      const result = await getNutritionDayLog(LOG_ID, USER_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(LOG_ID);
      expect(dayLogRepo.findById).toHaveBeenCalledWith(LOG_ID);
    });

    it('returns null when log not found', async () => {
      dayLogRepo.findById.mockResolvedValue(null);

      const result = await getNutritionDayLog('missing', USER_ID);
      expect(result).toBeNull();
    });

    it('throws when user does not own the log', async () => {
      dayLogRepo.findById.mockResolvedValue(makeDbLog({ userId: 'other-user' }));

      await expect(getNutritionDayLog(LOG_ID, USER_ID)).rejects.toThrow('Non hai i permessi');
    });
  });

  // ── getNutritionDayLogs ───────────────────────────────────────────

  describe('getNutritionDayLogs', () => {
    it('returns all logs for a user', async () => {
      dayLogRepo.findByUser.mockResolvedValue([makeDbLog(), makeDbLog({ id: 'log-2' })]);

      const result = await getNutritionDayLogs(USER_ID);

      expect(result).toHaveLength(2);
      expect(dayLogRepo.findByUser).toHaveBeenCalledWith(USER_ID, undefined, undefined);
    });

    it('passes planId and limit filters through', async () => {
      dayLogRepo.findByUser.mockResolvedValue([]);

      await getNutritionDayLogs(USER_ID, PLAN_ID, 10);

      expect(dayLogRepo.findByUser).toHaveBeenCalledWith(USER_ID, PLAN_ID, 10);
    });
  });

  // ── getPlanLogs ───────────────────────────────────────────────────

  describe('getPlanLogs', () => {
    it('delegates to getNutritionDayLogs with planId', async () => {
      dayLogRepo.findByUser.mockResolvedValue([makeDbLog()]);

      const result = await getPlanLogs(PLAN_ID, USER_ID);

      expect(result).toHaveLength(1);
      expect(dayLogRepo.findByUser).toHaveBeenCalledWith(USER_ID, PLAN_ID, undefined);
    });
  });

  // ── getLogForDay ──────────────────────────────────────────────────

  describe('getLogForDay', () => {
    it('returns the log for a specific day', async () => {
      dayLogRepo.findForDay.mockResolvedValue(makeDbLog());

      const result = await getLogForDay(USER_ID, PLAN_ID, 1, 1, NOW);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(LOG_ID);
      expect(dayLogRepo.findForDay).toHaveBeenCalledWith(USER_ID, PLAN_ID, 1, 1, NOW);
    });

    it('returns null when no log exists for that day', async () => {
      dayLogRepo.findForDay.mockResolvedValue(null);

      const result = await getLogForDay(USER_ID, PLAN_ID, 1, 1, NOW);
      expect(result).toBeNull();
    });
  });

  // ── updateNutritionDayLog ─────────────────────────────────────────

  describe('updateNutritionDayLog', () => {
    it('updates meals and returns the updated log', async () => {
      const updatedMeals = [makeMeal({ name: 'Updated Breakfast' })];
      dayLogRepo.findById.mockResolvedValue(makeDbLog());
      dayLogRepo.update.mockResolvedValue(makeDbLog({ meals: updatedMeals }));

      const result = await updateNutritionDayLog(LOG_ID, USER_ID, { meals: updatedMeals });

      expect(result.id).toBe(LOG_ID);
      expect(dayLogRepo.update).toHaveBeenCalledWith(LOG_ID, { meals: updatedMeals });
    });

    it('updates waterIntake', async () => {
      dayLogRepo.findById.mockResolvedValue(makeDbLog());
      dayLogRepo.update.mockResolvedValue(makeDbLog({ waterIntake: 2.5 }));

      const result = await updateNutritionDayLog(LOG_ID, USER_ID, { waterIntake: 2.5 });

      expect(dayLogRepo.update).toHaveBeenCalledWith(LOG_ID, { waterIntake: 2.5 });
      expect(result.waterIntake).toBe(2.5);
    });

    it('throws when log is not found', async () => {
      dayLogRepo.findById.mockResolvedValue(null);

      await expect(
        updateNutritionDayLog(LOG_ID, USER_ID, { notes: 'hi' })
      ).rejects.toThrow('Log non trovato');
    });

    it('throws when user does not own the log', async () => {
      dayLogRepo.findById.mockResolvedValue(makeDbLog({ userId: 'other-user' }));

      await expect(
        updateNutritionDayLog(LOG_ID, USER_ID, { notes: 'hi' })
      ).rejects.toThrow('Non hai i permessi');
    });
  });

  // ── deleteNutritionDayLog ─────────────────────────────────────────

  describe('deleteNutritionDayLog', () => {
    it('deletes the log when found and owned', async () => {
      dayLogRepo.findById.mockResolvedValue(makeDbLog());
      dayLogRepo.delete.mockResolvedValue(undefined);

      await deleteNutritionDayLog(LOG_ID, USER_ID);

      expect(dayLogRepo.delete).toHaveBeenCalledWith(LOG_ID);
    });

    it('throws when log is not found', async () => {
      dayLogRepo.findById.mockResolvedValue(null);

      await expect(deleteNutritionDayLog(LOG_ID, USER_ID)).rejects.toThrow('Log non trovato');
    });

    it('throws when user does not own the log', async () => {
      dayLogRepo.findById.mockResolvedValue(makeDbLog({ userId: 'other-user' }));

      await expect(deleteNutritionDayLog(LOG_ID, USER_ID)).rejects.toThrow('Non hai i permessi');
    });
  });

  // ── getNutritionPlanStats ─────────────────────────────────────────

  describe('getNutritionPlanStats', () => {
    it('returns stats for a plan with logged days', async () => {
      const plan = makePlanRecord();
      planRepo.findById.mockResolvedValue(plan);

      const logsWithMacros = [
        makeDbLog({
          actualDailyMacros: { calories: 2000, protein: 150, carbs: 200, fats: 70 },
          waterIntake: 2.0,
          date: new Date('2024-06-01'),
        }),
        makeDbLog({
          id: 'log-2',
          actualDailyMacros: { calories: 1800, protein: 140, carbs: 180, fats: 60 },
          waterIntake: 2.5,
          date: new Date('2024-06-02'),
        }),
      ];
      dayLogRepo.findByUser.mockResolvedValue(logsWithMacros);

      const stats = await getNutritionPlanStats(PLAN_ID, USER_ID);

      expect(stats.planId).toBe(PLAN_ID);
      expect(stats.loggedDays).toBe(2);
      expect(stats.averageCalories).toBe(1900);
      expect(stats.averageProtein).toBe(145);
      expect(stats.averageWaterIntake).toBeCloseTo(2.25);
      expect(stats.lastLogDate).toEqual(new Date('2024-06-02'));
    });

    it('returns zero adherence when plan has no logged days', async () => {
      planRepo.findById.mockResolvedValue(makePlanRecord());
      dayLogRepo.findByUser.mockResolvedValue([]);

      const stats = await getNutritionPlanStats(PLAN_ID, USER_ID);

      expect(stats.loggedDays).toBe(0);
      expect(stats.averageCalories).toBeUndefined();
      expect(stats.averageWaterIntake).toBeUndefined();
    });

    it('throws when plan not found', async () => {
      planRepo.findById.mockResolvedValue(null);

      await expect(getNutritionPlanStats(PLAN_ID, USER_ID)).rejects.toThrow(
        'Piano nutrizionale non trovato'
      );
    });

    it('throws when user does not own the plan', async () => {
      planRepo.findById.mockResolvedValue({ ...makePlanRecord(), userId: 'other-user' });

      await expect(getNutritionPlanStats(PLAN_ID, USER_ID)).rejects.toThrow('Non hai i permessi');
    });
  });

  // ── calculateActualDailyMacros (pure function) ────────────────────

  describe('calculateActualDailyMacros', () => {
    it('sums macros across all meals and foods', () => {
      const meals = [
        {
          name: 'Breakfast',
          foods: [
            { macros: { calories: 300, protein: 20, carbs: 30, fats: 10, fiber: 5 } },
            { macros: { calories: 200, protein: 15, carbs: 25, fats: 5, fiber: 3 } },
          ],
        },
        {
          name: 'Lunch',
          foods: [
            { macros: { calories: 500, protein: 40, carbs: 50, fats: 15, fiber: 8 } },
          ],
        },
      ];

      const result = calculateActualDailyMacros(meals);

      expect(result.calories).toBe(1000);
      expect(result.protein).toBe(75);
      expect(result.carbs).toBe(105);
      expect(result.fats).toBe(30);
      expect(result.fiber).toBe(16);
    });

    it('uses actualMacros when present on a food', () => {
      const meals = [
        {
          name: 'Dinner',
          foods: [
            {
              macros: { calories: 100, protein: 10, carbs: 10, fats: 5 },
              actualMacros: { calories: 150, protein: 12, carbs: 15, fats: 7 },
            },
          ],
        },
      ];

      const result = calculateActualDailyMacros(meals);
      // actualMacros takes priority
      expect(result.calories).toBe(150);
      expect(result.protein).toBe(12);
    });

    it('returns zeros for empty meals array', () => {
      const result = calculateActualDailyMacros([]);

      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fats).toBe(0);
    });

    it('handles meals with no foods', () => {
      const meals = [{ name: 'Empty Meal' }];
      const result = calculateActualDailyMacros(meals);

      expect(result.calories).toBe(0);
    });

    it('handles foods without macros gracefully', () => {
      const meals = [
        { name: 'Meal', foods: [{ name: 'Unknown food' }] },
      ];
      const result = calculateActualDailyMacros(meals);

      expect(result.calories).toBe(0);
    });
  });
});
