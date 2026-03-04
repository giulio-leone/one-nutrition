/**
 * OneNutrition
 *
 * Unified Nutrition Domain for OneCoach
 */

export * from './core';

export { initializeNutritionSchemas } from './registry';


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
