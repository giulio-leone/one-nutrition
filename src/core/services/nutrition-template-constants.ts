/**
 * Nutrition Template Constants
 *
 * Costanti e utility statiche per template nutrizionali
 * Separato dal service per evitare import di prisma in client components
 */

/**
 * Ottiene categorie disponibili per template nutrizionali
 */
export function getAvailableCategories(): string[] {
  return [
    'colazione',
    'pranzo',
    'cena',
    'snack',
    'pre-workout',
    'post-workout',
    'cut',
    'bulk',
    'maintenance',
    'vegetariano',
    'vegano',
    'keto',
    'low-carb',
    'high-protein',
  ];
}

/**
 * Activity factors for TDEE calculation
 */
export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Goal factors for calorie adjustment (deficit/surplus)
 */
export const GOAL_FACTORS = {
  weight_loss: 0.8, // 20% deficit
  muscle_gain: 1.1, // 10% surplus
  maintenance: 1.0,
  performance: 1.05, // 5% surplus
  health: 1.0,
  body_recomposition: 0.95, // 5% deficit
};

/**
 * Default macro ratios by goal
 */
export const DEFAULT_MACRO_RATIOS = {
  weight_loss: { protein: 0.35, carbs: 0.35, fats: 0.3 },
  muscle_gain: { protein: 0.3, carbs: 0.45, fats: 0.25 },
  maintenance: { protein: 0.25, carbs: 0.45, fats: 0.3 },
  performance: { protein: 0.25, carbs: 0.5, fats: 0.25 },
  health: { protein: 0.2, carbs: 0.5, fats: 0.3 },
  body_recomposition: { protein: 0.35, carbs: 0.35, fats: 0.3 },
};
