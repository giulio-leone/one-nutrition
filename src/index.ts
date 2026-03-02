/**
 * OneNutrition
 *
 * Unified Nutrition Domain for OneCoach
 */

export * from './core';

// Nutrition Generation (deprecated — use Gauss NutritionAgent)
export { initializeNutritionSchemas } from './registry';
export {
  generateNutritionPlan,
  type NutritionGenerationResult,
} from './services/nutrition-generation.service';

export {
  generateFoods,
  type FoodGenerationResult,
} from './services/food-generation.service';

// Agent services (deprecated — use Gauss NutritionAgent)
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
