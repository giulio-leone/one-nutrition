import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateTDEE,
  calculateCalorieNeeds,
  calculateMacrosFromRatios,
  calculateMacrosByDietType,
  suggestTargetCalories,
  validateNutritionTargets,
  validateMacroRatios,
  calculateCompleteNutritionTargets,
  macrosToCalories,
  getMacroPercentages,
  formatNutritionTargets,
  ACTIVITY_MULTIPLIERS,
  KCAL_PER_GRAM,
  SAFETY_RANGES,
  type UserMetrics,
  type NutritionTargets,
} from './nutrition-calculator';

// ============================================
// Test data: Realistic athlete profiles
// ============================================

const maleAthlete: UserMetrics = {
  weightKg: 80,
  heightCm: 180,
  age: 30,
  gender: 'male',
  activityLevel: 'active',
};

const femaleAthlete: UserMetrics = {
  weightKg: 60,
  heightCm: 165,
  age: 25,
  gender: 'female',
  activityLevel: 'moderate',
};

const sedentaryMale: UserMetrics = {
  weightKg: 90,
  heightCm: 175,
  age: 40,
  gender: 'male',
  activityLevel: 'sedentary',
};

// ============================================
// BMR Tests
// ============================================

describe('calculateBMR', () => {
  it('calculates BMR for male using Mifflin-St Jeor', () => {
    // Formula: 10 * 80 + 6.25 * 180 - 5 * 30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const bmr = calculateBMR(80, 180, 30, 'male');
    expect(bmr).toBe(1780);
  });

  it('calculates BMR for female using Mifflin-St Jeor', () => {
    // Formula: 10 * 60 + 6.25 * 165 - 5 * 25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 → 1345
    const bmr = calculateBMR(60, 165, 25, 'female');
    expect(bmr).toBe(1345);
  });

  it('male BMR is higher than female for same metrics', () => {
    const maleBMR = calculateBMR(70, 170, 30, 'male');
    const femaleBMR = calculateBMR(70, 170, 30, 'female');
    expect(maleBMR).toBeGreaterThan(femaleBMR);
    expect(maleBMR - femaleBMR).toBe(166); // 5 - (-161) = 166
  });

  it('BMR decreases with age', () => {
    const young = calculateBMR(75, 175, 20, 'male');
    const old = calculateBMR(75, 175, 50, 'male');
    expect(young).toBeGreaterThan(old);
    expect(young - old).toBe(150); // 5 * (50-20) = 150
  });

  it('BMR increases with weight', () => {
    const light = calculateBMR(60, 175, 30, 'male');
    const heavy = calculateBMR(100, 175, 30, 'male');
    expect(heavy).toBeGreaterThan(light);
    expect(heavy - light).toBe(400); // 10 * (100-60) = 400
  });
});

// ============================================
// TDEE Tests
// ============================================

describe('calculateTDEE', () => {
  const bmr = 1780;

  it('calculates TDEE for sedentary', () => {
    const tdee = calculateTDEE(bmr, 'sedentary');
    expect(tdee).toBe(Math.round(bmr * 1.2));
  });

  it('calculates TDEE for active', () => {
    const tdee = calculateTDEE(bmr, 'active');
    expect(tdee).toBe(Math.round(bmr * 1.725));
  });

  it('TDEE increases with activity level', () => {
    const levels: Array<keyof typeof ACTIVITY_MULTIPLIERS> = [
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active',
    ];
    const tdees = levels.map((l) => calculateTDEE(bmr, l));
    for (let i = 1; i < tdees.length; i++) {
      expect(tdees[i]).toBeGreaterThan(tdees[i - 1]!);
    }
  });

  it('calculates TDEE for very active', () => {
    const tdee = calculateTDEE(bmr, 'very_active');
    expect(tdee).toBe(Math.round(bmr * 1.9));
  });
});

// ============================================
// Calorie Needs (Combined)
// ============================================

describe('calculateCalorieNeeds', () => {
  it('returns both BMR and TDEE', () => {
    const result = calculateCalorieNeeds(maleAthlete);
    expect(result.bmr).toBeGreaterThan(0);
    expect(result.tdee).toBeGreaterThan(result.bmr);
  });

  it('TDEE = BMR × activity multiplier', () => {
    const result = calculateCalorieNeeds(maleAthlete);
    const expectedTDEE = Math.round(result.bmr * ACTIVITY_MULTIPLIERS[maleAthlete.activityLevel]);
    expect(result.tdee).toBe(expectedTDEE);
  });
});

// ============================================
// Macro Calculation Tests
// ============================================

describe('calculateMacrosFromRatios', () => {
  it('distributes 2000 kcal with standard ratios', () => {
    const macros = calculateMacrosFromRatios(2000, {
      proteinRatio: 0.3,
      carbsRatio: 0.4,
      fatRatio: 0.3,
    });
    expect(macros.protein).toBe(150); // 2000 * 0.3 / 4
    expect(macros.carbs).toBe(200); // 2000 * 0.4 / 4
    expect(macros.fat).toBe(67); // 2000 * 0.3 / 9 ≈ 66.67 → 67
    expect(macros.calories).toBe(2000);
  });

  it('handles keto ratios (very low carb)', () => {
    const macros = calculateMacrosFromRatios(2000, {
      proteinRatio: 0.25,
      carbsRatio: 0.05,
      fatRatio: 0.7,
    });
    expect(macros.carbs).toBe(25); // 2000 * 0.05 / 4
    expect(macros.fat).toBe(156); // 2000 * 0.7 / 9 ≈ 155.56 → 156
  });
});

describe('calculateMacrosByDietType', () => {
  it('calculates macros for omnivore muscle gain', () => {
    const macros = calculateMacrosByDietType(2500, 'omnivore', 80, 'muscle_gain');
    // Protein: 80kg * ((1.6+2.2)/2 = 1.9) = 152g
    expect(macros.protein).toBe(152);
    expect(macros.carbs).toBeGreaterThan(0);
    expect(macros.fat).toBeGreaterThan(0);
  });

  it('keto diet has very low carbs', () => {
    const macros = calculateMacrosByDietType(2000, 'keto', 75, 'maintenance');
    // Keto: carbsRatio=0.05, fatRatio=0.7
    const ketoMacros = calculateMacrosByDietType(2000, 'keto', 75, 'maintenance');
    const omniMacros = calculateMacrosByDietType(2000, 'omnivore', 75, 'maintenance');
    expect(ketoMacros.carbs).toBeLessThan(omniMacros.carbs);
    expect(ketoMacros.fat).toBeGreaterThan(omniMacros.fat);
  });

  it('weight loss has higher protein per kg', () => {
    const lossProtein = calculateMacrosByDietType(2000, 'omnivore', 80, 'weight_loss').protein;
    const maintProtein = calculateMacrosByDietType(2000, 'omnivore', 80, 'maintenance').protein;
    expect(lossProtein).toBeGreaterThan(maintProtein);
  });

  it('all macros are positive', () => {
    const macros = calculateMacrosByDietType(2000, 'vegan', 65, 'health');
    expect(macros.protein).toBeGreaterThan(0);
    expect(macros.carbs).toBeGreaterThan(0);
    expect(macros.fat).toBeGreaterThan(0);
  });
});

// ============================================
// Target Calories Tests
// ============================================

describe('suggestTargetCalories', () => {
  const tdee = 2500;

  it('weight loss creates deficit', () => {
    const result = suggestTargetCalories(tdee, 'weight_loss');
    expect(result.targetCalories).toBeLessThan(tdee);
    expect(result.deficit).toBeGreaterThan(0);
    expect(result.deficit).toBeLessThanOrEqual(SAFETY_RANGES.maxDeficit);
  });

  it('muscle gain creates surplus', () => {
    const result = suggestTargetCalories(tdee, 'muscle_gain');
    expect(result.targetCalories).toBeGreaterThan(tdee);
    expect(result.surplus).toBeGreaterThan(0);
    expect(result.surplus).toBeLessThanOrEqual(SAFETY_RANGES.maxSurplus);
  });

  it('maintenance equals TDEE', () => {
    const result = suggestTargetCalories(tdee, 'maintenance');
    expect(result.targetCalories).toBe(tdee);
    expect(result.deficit).toBeUndefined();
    expect(result.surplus).toBeUndefined();
  });

  it('body recomposition creates small deficit', () => {
    const result = suggestTargetCalories(tdee, 'body_recomposition');
    expect(result.targetCalories).toBeLessThan(tdee);
    expect(result.deficit).toBeGreaterThan(0);
    // Deficit should be smaller than weight loss
    const lossResult = suggestTargetCalories(tdee, 'weight_loss');
    expect(result.deficit).toBeLessThan(lossResult.deficit!);
  });

  it('performance creates moderate surplus', () => {
    const result = suggestTargetCalories(tdee, 'performance');
    expect(result.targetCalories).toBeGreaterThan(tdee);
    // Smaller than muscle gain
    const gainResult = suggestTargetCalories(tdee, 'muscle_gain');
    expect(result.surplus).toBeLessThan(gainResult.surplus!);
  });

  it('deficit is capped at maxDeficit', () => {
    const highTDEE = 6000;
    const result = suggestTargetCalories(highTDEE, 'weight_loss');
    expect(result.deficit).toBeLessThanOrEqual(SAFETY_RANGES.maxDeficit);
  });
});

// ============================================
// Validation Tests
// ============================================

describe('validateNutritionTargets', () => {
  it('validates correct targets', () => {
    const targets: NutritionTargets = {
      bmr: 1780,
      tdee: 2500,
      targetCalories: 2000,
      deficit: 500,
      macros: { protein: 150, carbs: 200, fat: 67, calories: 2000 },
    };
    const result = validateNutritionTargets(targets, 80);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects calories below minimum', () => {
    const targets: NutritionTargets = {
      bmr: 1400,
      tdee: 1800,
      targetCalories: 1000,
      macros: { protein: 80, carbs: 100, fat: 30, calories: 1000 },
    };
    const result = validateNutritionTargets(targets, 70);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('sotto il minimo'))).toBe(true);
  });

  it('warns on excessive protein per kg', () => {
    const targets: NutritionTargets = {
      bmr: 1780,
      tdee: 2500,
      targetCalories: 2500,
      macros: { protein: 250, carbs: 200, fat: 80, calories: 2500 },
    };
    const result = validateNutritionTargets(targets, 70);
    // 250/70 = 3.57 g/kg > 3.0 max
    expect(result.errors.some((e) => e.includes('sopra il massimo sicuro'))).toBe(true);
  });

  it('warns on macro-calorie mismatch', () => {
    const targets: NutritionTargets = {
      bmr: 1780,
      tdee: 2500,
      targetCalories: 2500,
      macros: { protein: 100, carbs: 100, fat: 50, calories: 2500 },
    };
    // Actual: 100*4 + 100*4 + 50*9 = 1250 kcal vs 2500 target
    const result = validateNutritionTargets(targets, 80);
    expect(result.warnings.some((w) => w.includes('non coerenti'))).toBe(true);
  });
});

describe('validateMacroRatios', () => {
  it('validates correct ratios summing to 1', () => {
    const result = validateMacroRatios({
      proteinRatio: 0.3,
      carbsRatio: 0.4,
      fatRatio: 0.3,
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects ratios not summing to 1', () => {
    const result = validateMacroRatios({
      proteinRatio: 0.3,
      carbsRatio: 0.3,
      fatRatio: 0.3,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('≠ 100%'))).toBe(true);
  });

  it('rejects fat below minimum', () => {
    const result = validateMacroRatios({
      proteinRatio: 0.5,
      carbsRatio: 0.4,
      fatRatio: 0.1,
    });
    expect(result.isValid).toBe(false);
  });
});

// ============================================
// Complete Pipeline Test
// ============================================

describe('calculateCompleteNutritionTargets', () => {
  it('calculates complete targets for male athlete', () => {
    const targets = calculateCompleteNutritionTargets(maleAthlete, 'muscle_gain', 'omnivore');

    expect(targets.bmr).toBeGreaterThan(1500);
    expect(targets.tdee).toBeGreaterThan(targets.bmr);
    expect(targets.targetCalories).toBeGreaterThan(targets.tdee); // surplus
    expect(targets.surplus).toBeGreaterThan(0);
    expect(targets.macros.protein).toBeGreaterThan(100);
    expect(targets.macros.carbs).toBeGreaterThan(0);
    expect(targets.macros.fat).toBeGreaterThan(0);
  });

  it('calculates complete targets for female weight loss', () => {
    const targets = calculateCompleteNutritionTargets(femaleAthlete, 'weight_loss', 'mediterranean');

    expect(targets.targetCalories).toBeLessThan(targets.tdee); // deficit
    expect(targets.deficit).toBeGreaterThan(0);
  });

  it('defaults to omnivore when no diet type specified', () => {
    const targets = calculateCompleteNutritionTargets(maleAthlete, 'maintenance');
    expect(targets.targetCalories).toBe(targets.tdee);
  });

  it('passes validation for all standard profiles', () => {
    const profiles: UserMetrics[] = [maleAthlete, femaleAthlete, sedentaryMale];
    const goals = ['maintenance', 'muscle_gain', 'weight_loss'] as const;

    for (const profile of profiles) {
      for (const goal of goals) {
        const targets = calculateCompleteNutritionTargets(profile, goal);
        const validation = validateNutritionTargets(targets, profile.weightKg);
        expect(validation.isValid).toBe(true);
      }
    }
  });
});

// ============================================
// Utility Functions
// ============================================

describe('macrosToCalories', () => {
  it('converts macros to calories correctly', () => {
    const calories = macrosToCalories({ protein: 150, carbs: 200, fat: 67 });
    // 150*4 + 200*4 + 67*9 = 600 + 800 + 603 = 2003
    expect(calories).toBe(2003);
  });
});

describe('getMacroPercentages', () => {
  it('calculates percentages', () => {
    const pct = getMacroPercentages({ protein: 150, carbs: 200, fat: 67, calories: 2000 });
    expect(pct.protein + pct.carbs + pct.fat).toBeGreaterThanOrEqual(98);
    expect(pct.protein + pct.carbs + pct.fat).toBeLessThanOrEqual(102);
  });
});

describe('formatNutritionTargets', () => {
  it('formats with deficit', () => {
    const targets: NutritionTargets = {
      bmr: 1780,
      tdee: 2500,
      targetCalories: 2000,
      deficit: 500,
      macros: { protein: 150, carbs: 200, fat: 67, calories: 2000 },
    };
    const formatted = formatNutritionTargets(targets);
    expect(formatted).toContain('BMR: 1780');
    expect(formatted).toContain('TDEE: 2500');
    expect(formatted).toContain('deficit: 500');
    expect(formatted).toContain('Proteine: 150g');
  });

  it('formats maintenance (no deficit/surplus)', () => {
    const targets: NutritionTargets = {
      bmr: 1780,
      tdee: 2500,
      targetCalories: 2500,
      macros: { protein: 150, carbs: 250, fat: 83, calories: 2500 },
    };
    const formatted = formatNutritionTargets(targets);
    expect(formatted).toContain('mantenimento');
  });
});
