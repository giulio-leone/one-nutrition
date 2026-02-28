import { describe, it, expect } from 'vitest';
import {
  analyzeNutritionAdherence,
  generateNutritionAdaptationPlan,
} from '../nutrition-adaptation.service';
import type { DailyNutritionLog, NutritionPlanTargets } from '../types';

// ==================== HELPERS ====================

function makeTargets(overrides?: Partial<NutritionPlanTargets>): NutritionPlanTargets {
  return {
    dailyCalories: 2500,
    proteinG: 180,
    carbG: 280,
    fatG: 80,
    meals: [
      { mealName: 'Breakfast', calories: 600 },
      { mealName: 'Lunch', calories: 800 },
      { mealName: 'Dinner', calories: 800 },
      { mealName: 'Snack', calories: 300 },
    ],
    ...overrides,
  };
}

function makeLog(overrides?: Partial<DailyNutritionLog>): DailyNutritionLog {
  return {
    date: '2024-01-15',
    totalCalories: 2500,
    proteinG: 180,
    carbG: 280,
    fatG: 80,
    meals: [
      { mealName: 'Breakfast', calories: 600, proteinG: 40, carbG: 70, fatG: 20 },
      { mealName: 'Lunch', calories: 800, proteinG: 50, carbG: 90, fatG: 25 },
      { mealName: 'Dinner', calories: 800, proteinG: 60, carbG: 80, fatG: 25 },
      { mealName: 'Snack', calories: 300, proteinG: 30, carbG: 40, fatG: 10 },
    ],
    ...overrides,
  };
}

function makeDays(n: number, factory: (i: number) => DailyNutritionLog): DailyNutritionLog[] {
  return Array.from({ length: n }, (_, i) => factory(i));
}

// ==================== analyzeNutritionAdherence ====================

describe('analyzeNutritionAdherence', () => {
  it('returns excellent adherence for perfect tracking', () => {
    const logs = makeDays(7, (i) => makeLog({ date: `2024-01-${15 + i}` }));
    const targets = makeTargets();

    const result = analyzeNutritionAdherence({ userId: 'u1', planId: 'plan1', logs, targets });

    expect(result.periodDays).toBe(7);
    expect(result.macroAdherence.proteinAdherence).toBeCloseTo(1, 1);
    expect(result.macroAdherence.carbAdherence).toBeCloseTo(1, 1);
    expect(result.macroAdherence.fatAdherence).toBeCloseTo(1, 1);
    expect(result.calorieVariance.variancePercent).toBeCloseTo(0, 1);
    expect(result.consistencyScore).toBe(1);
    expect(result.overallAdherence).toBe('excellent');
  });

  it('returns poor adherence for very low intake', () => {
    const logs = makeDays(7, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 1200,
        proteinG: 60,
        carbG: 100,
        fatG: 50,
        meals: [
          { mealName: 'Lunch', calories: 700, proteinG: 35, carbG: 60, fatG: 30 },
          { mealName: 'Dinner', calories: 500, proteinG: 25, carbG: 40, fatG: 20 },
        ],
      })
    );
    const targets = makeTargets();

    const result = analyzeNutritionAdherence({ userId: 'u1', planId: 'plan1', logs, targets });

    expect(result.macroAdherence.proteinAdherence).toBeLessThan(0.5);
    expect(result.calorieVariance.variancePercent).toBeLessThan(-15);
    expect(result.consistencyScore).toBe(0); // all days outside ±10%
    expect(result.overallAdherence).toBe('poor');
  });

  it('returns empty analysis for no logs', () => {
    const result = analyzeNutritionAdherence({
      userId: 'u1',
      planId: 'plan1',
      logs: [],
      targets: makeTargets(),
    });

    expect(result.periodDays).toBe(0);
    expect(result.macroAdherence.proteinAdherence).toBe(0);
    expect(result.calorieVariance.averageCalories).toBe(0);
    expect(result.consistencyScore).toBe(0);
    expect(result.mealAdherence).toEqual([]);
    expect(result.overallAdherence).toBe('poor');
  });

  it('correctly calculates calorie variance', () => {
    // All days at 2800 cal → +12% over 2500 target
    const logs = makeDays(5, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 2800,
        meals: [
          { mealName: 'Breakfast', calories: 700, proteinG: 40, carbG: 80, fatG: 25 },
          { mealName: 'Lunch', calories: 900, proteinG: 50, carbG: 100, fatG: 30 },
          { mealName: 'Dinner', calories: 900, proteinG: 60, carbG: 90, fatG: 30 },
          { mealName: 'Snack', calories: 300, proteinG: 30, carbG: 40, fatG: 10 },
        ],
      })
    );

    const result = analyzeNutritionAdherence({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    expect(result.calorieVariance.averageCalories).toBeCloseTo(2800, 0);
    expect(result.calorieVariance.variancePercent).toBeCloseTo(12, 0);
    expect(result.calorieVariance.standardDeviation).toBeCloseTo(0, 0);
    expect(result.calorieVariance.totalDays).toBe(5);
  });

  it('identifies consistent days correctly', () => {
    // Target 2500. Within ±10% = 2250–2750
    const logs = [
      makeLog({ date: '2024-01-15', totalCalories: 2500 }), // within
      makeLog({ date: '2024-01-16', totalCalories: 2400 }), // within
      makeLog({ date: '2024-01-17', totalCalories: 2000 }), // outside
      makeLog({ date: '2024-01-18', totalCalories: 3000 }), // outside
      makeLog({ date: '2024-01-19', totalCalories: 2600 }), // within
    ];

    const result = analyzeNutritionAdherence({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    expect(result.calorieVariance.consistentDays).toBe(3);
    expect(result.calorieVariance.totalDays).toBe(5);
  });

  it('computes per-meal adherence with problematic meals', () => {
    // Only log Breakfast and Lunch, skip Dinner and Snack
    const logs = makeDays(4, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 1400,
        meals: [
          { mealName: 'Breakfast', calories: 600, proteinG: 40, carbG: 70, fatG: 20 },
          { mealName: 'Lunch', calories: 800, proteinG: 50, carbG: 90, fatG: 25 },
        ],
      })
    );

    const result = analyzeNutritionAdherence({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    // Breakfast and Lunch should have adherenceRate = 1.0
    const breakfast = result.mealAdherence.find((m) => m.mealName === 'breakfast');
    expect(breakfast).toBeDefined();
    expect(breakfast!.adherenceRate).toBe(1);
    expect(breakfast!.isProblematic).toBe(false);

    // Dinner and Snack should be 0 adherence → problematic
    const dinner = result.mealAdherence.find((m) => m.mealName === 'dinner');
    expect(dinner).toBeDefined();
    expect(dinner!.adherenceRate).toBe(0);
    expect(dinner!.isProblematic).toBe(true);

    const snack = result.mealAdherence.find((m) => m.mealName === 'snack');
    expect(snack).toBeDefined();
    expect(snack!.isProblematic).toBe(true);
  });

  it('handles moderate adherence correctly', () => {
    // ~75% macro adherence, moderate consistency
    const logs = makeDays(7, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: i < 5 ? 2400 : 1800, // 5 consistent, 2 off
        proteinG: 140,
        carbG: 200,
        fatG: 65,
        meals: [
          { mealName: 'Breakfast', calories: 500, proteinG: 30, carbG: 50, fatG: 15 },
          { mealName: 'Lunch', calories: 700, proteinG: 40, carbG: 60, fatG: 20 },
          { mealName: 'Dinner', calories: 700, proteinG: 45, carbG: 60, fatG: 20 },
          { mealName: 'Snack', calories: i < 5 ? 500 : 0, proteinG: 25, carbG: 30, fatG: 10 },
        ],
      })
    );

    const result = analyzeNutritionAdherence({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    expect(result.macroAdherence.proteinAdherence).toBeLessThan(1);
    expect(result.macroAdherence.proteinAdherence).toBeGreaterThan(0.5);
    expect(['good', 'moderate']).toContain(result.overallAdherence);
  });
});

// ==================== generateNutritionAdaptationPlan ====================

describe('generateNutritionAdaptationPlan', () => {
  it('returns a plan with status pending', () => {
    const logs = makeDays(7, (i) => makeLog({ date: `2024-01-${15 + i}` }));

    const plan = generateNutritionAdaptationPlan({
      userId: 'u1',
      planId: 'plan1',
      logs,
      targets: makeTargets(),
    });

    expect(plan.status).toBe('pending');
    expect(plan.userId).toBe('u1');
    expect(plan.planId).toBe('plan1');
    expect(plan.id).toMatch(/^nutri_adapt_/);
    expect(plan.createdAt).toBeDefined();
    expect(plan.analysis).toBeDefined();
  });

  it('generates no adjustments when adherence is perfect', () => {
    const logs = makeDays(7, (i) => makeLog({ date: `2024-01-${15 + i}` }));

    const plan = generateNutritionAdaptationPlan({
      userId: 'u1',
      planId: 'plan1',
      logs,
      targets: makeTargets(),
    });

    expect(plan.adjustments.length).toBe(0);
    expect(plan.mealSwaps.length).toBe(0);
  });

  it('generates calorie_decrease adjustment when eating too much', () => {
    const logs = makeDays(7, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 3200, // +28% over 2500
        meals: [
          { mealName: 'Breakfast', calories: 900, proteinG: 50, carbG: 100, fatG: 35 },
          { mealName: 'Lunch', calories: 1000, proteinG: 60, carbG: 110, fatG: 35 },
          { mealName: 'Dinner', calories: 1000, proteinG: 60, carbG: 100, fatG: 35 },
          { mealName: 'Snack', calories: 300, proteinG: 30, carbG: 40, fatG: 10 },
        ],
      })
    );

    const plan = generateNutritionAdaptationPlan({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    const calDecrease = plan.adjustments.find((a) => a.type === 'calorie_decrease');
    expect(calDecrease).toBeDefined();
    expect(calDecrease!.priority).toBe('high');
  });

  it('generates calorie_increase adjustment when eating too little', () => {
    const logs = makeDays(7, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 1800, // -28% under 2500
        proteinG: 100,
        carbG: 180,
        fatG: 55,
        meals: [
          { mealName: 'Breakfast', calories: 400, proteinG: 25, carbG: 50, fatG: 15 },
          { mealName: 'Lunch', calories: 600, proteinG: 35, carbG: 60, fatG: 20 },
          { mealName: 'Dinner', calories: 600, proteinG: 30, carbG: 50, fatG: 15 },
          { mealName: 'Snack', calories: 200, proteinG: 10, carbG: 20, fatG: 5 },
        ],
      })
    );

    const plan = generateNutritionAdaptationPlan({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    const calIncrease = plan.adjustments.find((a) => a.type === 'calorie_increase');
    expect(calIncrease).toBeDefined();
    expect(calIncrease!.priority).toBe('high');
  });

  it('generates protein_increase when protein is low', () => {
    const logs = makeDays(7, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 2500,
        proteinG: 100, // 55% of 180g target → below 85%
        carbG: 350,
        fatG: 80,
        meals: [
          { mealName: 'Breakfast', calories: 600, proteinG: 20, carbG: 90, fatG: 20 },
          { mealName: 'Lunch', calories: 800, proteinG: 30, carbG: 110, fatG: 25 },
          { mealName: 'Dinner', calories: 800, proteinG: 35, carbG: 100, fatG: 25 },
          { mealName: 'Snack', calories: 300, proteinG: 15, carbG: 50, fatG: 10 },
        ],
      })
    );

    const plan = generateNutritionAdaptationPlan({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    const proteinAdj = plan.adjustments.find((a) => a.type === 'protein_increase');
    expect(proteinAdj).toBeDefined();
    expect(proteinAdj!.priority).toBe('high');
  });

  it('generates meal swaps for skipped meals', () => {
    // Skip Dinner and Snack
    const logs = makeDays(7, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 1400,
        proteinG: 90,
        carbG: 160,
        fatG: 45,
        meals: [
          { mealName: 'Breakfast', calories: 600, proteinG: 40, carbG: 70, fatG: 20 },
          { mealName: 'Lunch', calories: 800, proteinG: 50, carbG: 90, fatG: 25 },
        ],
      })
    );

    const plan = generateNutritionAdaptationPlan({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    expect(plan.mealSwaps.length).toBeGreaterThanOrEqual(2);
    const dinnerSwap = plan.mealSwaps.find((s) => s.mealName === 'dinner');
    expect(dinnerSwap).toBeDefined();
    expect(dinnerSwap!.suggestion).toContain('skipped');
  });

  it('generates carb_adjust when carb adherence is off', () => {
    const logs = makeDays(7, (i) =>
      makeLog({
        date: `2024-01-${15 + i}`,
        totalCalories: 2500,
        proteinG: 180,
        carbG: 150, // 53% of 280g → below 75%
        fatG: 120,  // 150% of 80g → above 125%
        meals: [
          { mealName: 'Breakfast', calories: 600, proteinG: 40, carbG: 30, fatG: 35 },
          { mealName: 'Lunch', calories: 800, proteinG: 50, carbG: 50, fatG: 35 },
          { mealName: 'Dinner', calories: 800, proteinG: 60, carbG: 50, fatG: 35 },
          { mealName: 'Snack', calories: 300, proteinG: 30, carbG: 20, fatG: 15 },
        ],
      })
    );

    const plan = generateNutritionAdaptationPlan({ userId: 'u1', planId: 'plan1', logs, targets: makeTargets() });

    const carbAdj = plan.adjustments.find((a) => a.type === 'carb_adjust');
    expect(carbAdj).toBeDefined();

    const fatAdj = plan.adjustments.find((a) => a.type === 'fat_adjust');
    expect(fatAdj).toBeDefined();
  });

  it('handles empty logs gracefully', () => {
    const plan = generateNutritionAdaptationPlan({
      userId: 'u1',
      planId: 'plan1',
      logs: [],
      targets: makeTargets(),
    });

    expect(plan.status).toBe('pending');
    expect(plan.analysis.periodDays).toBe(0);
    expect(plan.analysis.overallAdherence).toBe('poor');
  });
});
