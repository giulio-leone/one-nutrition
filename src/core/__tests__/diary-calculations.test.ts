import { describe, it, expect } from 'vitest';
import {
  calculateConsumedMacros,
  calculateAdherence,
  calculateRemaining,
  isOverTarget,
} from '../utils/diary-calculations';
import type { DiaryMeal, MacroTarget } from '../utils/diary-calculations';

const makeMeal = (overrides: Partial<DiaryMeal> = {}): DiaryMeal => ({
  id: 'meal1',
  name: 'Breakfast',
  type: 'breakfast',
  foods: [],
  status: 'pending',
  ...overrides,
});

const makeFood = (cal: number, p: number, c: number, f: number) => ({
  id: `food_${Math.random().toString(36).slice(2)}`,
  name: 'Test Food',
  quantity: 100,
  unit: 'g',
  macros: { calories: cal, protein: p, carbs: c, fats: f },
});

const TARGET: MacroTarget = { calories: 2000, protein: 150, carbs: 250, fats: 67 };

describe('calculateConsumedMacros', () => {
  it('returns zeros for empty meals', () => {
    expect(calculateConsumedMacros([])).toEqual({
      calories: 0, protein: 0, carbs: 0, fats: 0,
    });
  });

  it('sums macros across meals and foods', () => {
    const meals: DiaryMeal[] = [
      makeMeal({
        id: 'm1',
        status: 'done',
        foods: [makeFood(300, 25, 40, 10), makeFood(200, 15, 20, 8)],
      }),
      makeMeal({
        id: 'm2',
        status: 'pending',
        foods: [makeFood(500, 40, 60, 15)],
      }),
    ];
    const result = calculateConsumedMacros(meals);
    expect(result.calories).toBe(1000);
    expect(result.protein).toBe(80);
    expect(result.carbs).toBe(120);
    expect(result.fats).toBe(33);
  });

  it('excludes skipped meals', () => {
    const meals: DiaryMeal[] = [
      makeMeal({
        id: 'm1',
        status: 'done',
        foods: [makeFood(300, 25, 40, 10)],
      }),
      makeMeal({
        id: 'm2',
        status: 'skipped',
        foods: [makeFood(500, 40, 60, 15)],
      }),
    ];
    const result = calculateConsumedMacros(meals);
    expect(result.calories).toBe(300);
    expect(result.protein).toBe(25);
  });

  it('includes pending meals', () => {
    const meals: DiaryMeal[] = [
      makeMeal({
        id: 'm1',
        status: 'pending',
        foods: [makeFood(400, 30, 50, 12)],
      }),
    ];
    expect(calculateConsumedMacros(meals).calories).toBe(400);
  });
});

describe('calculateAdherence', () => {
  it('returns 0 for empty meals', () => {
    expect(calculateAdherence([])).toBe(0);
  });

  it('returns 100 when all meals done', () => {
    const meals = [
      makeMeal({ id: 'm1', status: 'done' }),
      makeMeal({ id: 'm2', status: 'done' }),
    ];
    expect(calculateAdherence(meals)).toBe(100);
  });

  it('returns 0 when no meals done', () => {
    const meals = [
      makeMeal({ id: 'm1', status: 'pending' }),
      makeMeal({ id: 'm2', status: 'skipped' }),
    ];
    expect(calculateAdherence(meals)).toBe(0);
  });

  it('calculates partial adherence', () => {
    const meals = [
      makeMeal({ id: 'm1', status: 'done' }),
      makeMeal({ id: 'm2', status: 'pending' }),
      makeMeal({ id: 'm3', status: 'skipped' }),
      makeMeal({ id: 'm4', status: 'done' }),
    ];
    expect(calculateAdherence(meals)).toBe(50); // 2/4
  });
});

describe('calculateRemaining', () => {
  it('calculates remaining when under target', () => {
    const consumed: MacroTarget = { calories: 1200, protein: 90, carbs: 150, fats: 40 };
    const result = calculateRemaining(consumed, TARGET);
    expect(result.calories).toBe(800);
    expect(result.protein).toBe(60);
    expect(result.carbs).toBe(100);
    expect(result.fats).toBe(27);
  });

  it('returns 0 when over target', () => {
    const consumed: MacroTarget = { calories: 2500, protein: 200, carbs: 300, fats: 80 };
    const result = calculateRemaining(consumed, TARGET);
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fats).toBe(0);
  });

  it('handles exact target', () => {
    const result = calculateRemaining(TARGET, TARGET);
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
  });
});

describe('isOverTarget', () => {
  it('returns false when under target', () => {
    const consumed: MacroTarget = { calories: 1500, protein: 100, carbs: 200, fats: 50 };
    const result = isOverTarget(consumed, TARGET);
    expect(result.calories).toBe(false);
    expect(result.protein).toBe(false);
  });

  it('returns true when over target', () => {
    const consumed: MacroTarget = { calories: 2500, protein: 160, carbs: 200, fats: 50 };
    const result = isOverTarget(consumed, TARGET);
    expect(result.calories).toBe(true);
    expect(result.protein).toBe(true);
    expect(result.carbs).toBe(false);
    expect(result.fats).toBe(false);
  });

  it('returns false when exactly at target', () => {
    const result = isOverTarget(TARGET, TARGET);
    expect(result.calories).toBe(false);
  });
});
