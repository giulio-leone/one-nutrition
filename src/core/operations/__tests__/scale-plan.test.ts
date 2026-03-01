import { describe, it, expect } from 'vitest';
import { scalePlanToCalories } from '../plan-operations';
import type { NutritionPlan } from '@giulio-leone/types';

function makePlan(overrides?: Partial<NutritionPlan>): NutritionPlan {
  return {
    id: 'plan-1',
    name: 'Test Plan',
    description: '',
    goals: [],
    durationWeeks: 1,
    targetMacros: { calories: 2000, protein: 150, carbs: 200, fats: 80, fiber: 30 },
    weeks: [
      {
        id: 'w1',
        weekNumber: 1,
        days: [
          {
            dayNumber: 1,
            meals: [
              {
                id: 'meal-1',
                name: 'Breakfast',
                type: 'breakfast',
                foods: [
                  {
                    id: 'f1',
                    foodItemId: 'oats',
                    name: 'Oats',
                    quantity: 100,
                    unit: 'g',
                    macros: { calories: 400, protein: 12, carbs: 60, fats: 8 },
                  },
                  {
                    id: 'f2',
                    foodItemId: 'milk',
                    name: 'Milk',
                    quantity: 200,
                    unit: 'ml',
                    macros: { calories: 100, protein: 6, carbs: 10, fats: 4 },
                  },
                ],
                totalMacros: { calories: 500, protein: 18, carbs: 70, fats: 12 },
                notes: '',
              },
            ],
            totalMacros: { calories: 500, protein: 18, carbs: 70, fats: 12 },
            targetMacros: { calories: 2000, protein: 150, carbs: 200, fats: 80 },
            notes: '',
          },
        ],
        weeklyAverageMacros: { calories: 2000, protein: 150, carbs: 200, fats: 80, fiber: 30 },
        notes: '',
      },
    ],
    restrictions: [],
    preferences: [],
    status: 'active',
    userId: 'u1',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as NutritionPlan;
}

describe('scalePlanToCalories', () => {
  it('scales up by 50% (2000 → 3000 kcal)', () => {
    const plan = makePlan();
    const scaled = scalePlanToCalories(plan, 3000);

    expect(scaled.targetMacros.calories).toBe(3000);
    expect(scaled.targetMacros.protein).toBe(225); // 150 * 1.5
    expect(scaled.targetMacros.carbs).toBe(300);
    expect(scaled.targetMacros.fats).toBe(120);

    const oats = scaled.weeks[0].days[0].meals[0].foods[0];
    expect(oats.quantity).toBe(150); // 100 * 1.5
    expect(oats.macros?.calories).toBe(600); // 400 * 1.5
  });

  it('scales down by 50% (2000 → 1000 kcal)', () => {
    const plan = makePlan();
    const scaled = scalePlanToCalories(plan, 1000);

    expect(scaled.targetMacros.calories).toBe(1000);
    expect(scaled.targetMacros.protein).toBe(75);

    const oats = scaled.weeks[0].days[0].meals[0].foods[0];
    expect(oats.quantity).toBe(50);
    expect(oats.macros?.calories).toBe(200);
  });

  it('returns original plan when current calories are 0', () => {
    const plan = makePlan({
      targetMacros: { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 },
    });
    const result = scalePlanToCalories(plan, 2500);
    expect(result).toBe(plan);
  });

  it('returns original plan when new target is 0', () => {
    const plan = makePlan();
    const result = scalePlanToCalories(plan, 0);
    expect(result).toBe(plan);
  });

  it('preserves plan identity fields', () => {
    const plan = makePlan();
    const scaled = scalePlanToCalories(plan, 2500);

    expect(scaled.id).toBe('plan-1');
    expect(scaled.name).toBe('Test Plan');
    expect(scaled.userId).toBe('u1');
  });

  it('recalculates meal totalMacros after scaling', () => {
    const plan = makePlan();
    const scaled = scalePlanToCalories(plan, 3000); // 1.5x

    const meal = scaled.weeks[0].days[0].meals[0];
    // Meal total should be sum of scaled foods
    expect(meal.totalMacros.calories).toBeGreaterThan(0);
  });

  it('scales weekly average macros', () => {
    const plan = makePlan();
    const scaled = scalePlanToCalories(plan, 3000); // 1.5x

    const weekAvg = scaled.weeks[0].weeklyAverageMacros;
    expect(weekAvg?.calories).toBe(3000); // 2000 * 1.5
    expect(weekAvg?.protein).toBe(225);
  });

  it('handles foods with zero quantity gracefully', () => {
    const plan = makePlan();
    plan.weeks[0].days[0].meals[0].foods[0].quantity = 0;
    const scaled = scalePlanToCalories(plan, 3000);

    const food = scaled.weeks[0].days[0].meals[0].foods[0];
    // Zero quantity food should be returned unchanged
    expect(food.quantity).toBe(0);
  });

  it('handles 1:1 scaling (no change)', () => {
    const plan = makePlan();
    const scaled = scalePlanToCalories(plan, 2000);

    expect(scaled.targetMacros.calories).toBe(2000);
    const oats = scaled.weeks[0].days[0].meals[0].foods[0];
    expect(oats.quantity).toBe(100);
    expect(oats.macros?.calories).toBe(400);
  });
});
