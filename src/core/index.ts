/**
 * Nutrition Core Utilities
 *
 * Pure functions, stateless calculators, and domain logic.
 * These utilities are designed to be testable without database side effects.
 */

// Calculators
export * from './calculators/nutrition-calculator';

// Operations
export * from './operations/plan-operations';

// Utils
export * from './utils/nutrition-plan-helpers';
export * from './helpers/prisma-helpers';
export * from './helpers/imported-nutrition.schema';
export * from './helpers/plan-sync';
export * from './helpers/template-helpers';

// Transformers
export * from './transformers/plan-transform';
export * from './transformers/plan-server-transform';

// Normalizers
export * from './normalizers/plan-normalizer';

// Services
export * from './services';
