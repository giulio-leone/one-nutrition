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

// Streaming / Agent services
export {
  NutritionPlannerAgent,
} from './services/nutrition-planner-agent';
export {
  NutritionGenerationConfigService,
  type NutritionModelConfig,
} from './services/nutrition-generation-config.service';
export {
  createNutritionEventSender,
  type NutritionEventSender,
} from './services/nutrition-event-sender';

// Shopping
export { ShoppingGeneratorService } from './services/shopping-generator.service';

// Adaptation pipeline (M3)
export * from './adaptation';
export {
  shoppingPreferencesSchema,
  type ShoppingPreferences,
} from './services/shopping-preferences.schema';
