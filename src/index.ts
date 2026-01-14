/**
 * OneNutrition
 *
 * Unified Nutrition Domain for OneCoach
 */

export * from './core';

// SDK v3.1 Nutrition Generation - Use named exports to avoid conflicts
export { initializeNutritionSchemas } from './registry';
export {
  generateNutritionPlan,
  initializeNutritionGeneration,
  type NutritionGenerationResult,
  type GenerateOptions,
} from './services/nutrition-generation.service';

export {
  generateFoods,
  initializeFoodGeneration,
  type FoodGenerationResult,
} from './services/food-generation.service';
