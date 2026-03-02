// nutrition-import excluded from barrel: depends on lib-import-core → lib-ai (not installed).
// Import directly from '@giulio-leone/one-nutrition/core/services/nutrition-import.service' if needed.
// food-auto-creation excluded from barrel: depends on lib-food → lib-core (circular)
// Import directly if needed: @giulio-leone/one-nutrition/server-transform
// ModificationService moved to @giulio-leone/lib-copilot-framework
export * from './nutrition-template.service';
export * from './nutrition-tracking.service';
export * from './nutrition.service';
export * from './meal-template.service';
export * from './nutrition-template-constants';
// macro-recalculator moved to @giulio-leone/lib-copilot-framework
