/**
 * OneNutrition Schema & Tools Registry
 *
 * Registers schemas, tools, and transforms with OneAgent SDK.
 * Call initializeNutritionSchemas() before executing nutrition agents.
 */

import { registerSchemas, registerTools, registerTransforms } from '@onecoach/one-agent/framework';

// ==================== MAIN COORDINATOR SCHEMAS ====================

import {
  NutritionGenerationInputSchema,
  NutritionGenerationOutputSchema,
} from './sdk-agents/nutrition-generation/schema';

import {
  FoodGenerationInputSchema,
  FoodGenerationOutputSchema,
} from './sdk-agents/food-generation/schema';

// ==================== WORKER SCHEMAS ====================

import {
  MealPlannerInputSchema,
  MealPlannerOutputSchema,
} from './sdk-agents/nutrition-generation/workers/meal-planner/schema';

import {
  FoodSelectorInputSchema,
  FoodSelectorOutputSchema,
} from './sdk-agents/nutrition-generation/workers/food-selector/schema';

import {
  PatternGeneratorInputSchema,
  PatternGeneratorOutputSchema,
} from './sdk-agents/nutrition-generation/workers/pattern-generator/schema';

import {
  ValidatorInputSchema,
  ValidatorOutputSchema,
} from './sdk-agents/nutrition-generation/workers/validator/schema';

// ==================== TRANSFORMS ====================

import {
  calculateDailyMacros,
  distributeMealMacros,
  assemblePlan,
  type CalculateDailyMacrosInput,
  type DistributeMealMacrosInput,
  type AssemblePlanInput,
} from './sdk-agents/nutrition-generation/transforms';

// ==================== LOCAL TOOLS ====================

import { nutritionTools } from './sdk-agents/nutrition-generation/tools/tools';

// ==================== TRANSFORM WRAPPERS ====================

/**
 * Transform wrapper for calculateDailyMacros
 * Accepts generic Record and casts to expected input type
 */
function calculateDailyMacrosTransform(input: Record<string, unknown>): unknown {
  return calculateDailyMacros(input as Record<string, unknown> & CalculateDailyMacrosInput);
}

/**
 * Transform wrapper for distributeMealMacros
 */
function distributeMealMacrosTransform(input: Record<string, unknown>): unknown {
  return distributeMealMacros(input as Record<string, unknown> & DistributeMealMacrosInput);
}

/**
 * Transform wrapper for assemblePlan
 */
function assemblePlanTransform(input: Record<string, unknown>): unknown {
  const result = assemblePlan(input as Record<string, unknown> & AssemblePlanInput);

  // Return complete output matching NutritionGenerationOutputSchema
  // This is used directly by skipSynthesis in engine.ts
  return {
    plan: result,
    tokensUsed: 0, // Will be updated from context.meta
    costUSD: 0, // Will be updated from context.meta
    generatedAt: new Date().toISOString(),
  };
}

// ==================== INITIALIZATION ====================

let initialized = false;

/**
 * Initialize all nutrition schemas, tools, and transforms with the SDK registry
 */
export function initializeNutritionSchemas(): void {
  if (initialized) return;

  // Register all schemas at once
  registerSchemas({
    // Coordinator schemas
    'nutrition-generation:input': NutritionGenerationInputSchema,
    'nutrition-generation:output': NutritionGenerationOutputSchema,
    // Food Generation
    'food-generation:input': FoodGenerationInputSchema,
    'food-generation:output': FoodGenerationOutputSchema,
    // Meal Planner
    'meal-planner:input': MealPlannerInputSchema,
    'meal-planner:output': MealPlannerOutputSchema,
    // Food Selector
    'food-selector:input': FoodSelectorInputSchema,
    'food-selector:output': FoodSelectorOutputSchema,
    // Pattern Generator
    'pattern-generator:input': PatternGeneratorInputSchema,
    'pattern-generator:output': PatternGeneratorOutputSchema,
    // Validator
    'nutrition-validator:input': ValidatorInputSchema,
    'nutrition-validator:output': ValidatorOutputSchema,
  });

  // Register local tools for nutrition generation
  registerTools({ 'nutrition-generation': nutritionTools });

  // Register transforms for deterministic operations
  registerTransforms({
    calculateDailyMacros: calculateDailyMacrosTransform,
    distributeMealMacros: distributeMealMacrosTransform,
    assemblePlan: assemblePlanTransform,
  });

  initialized = true;
}

// ==================== RE-EXPORTS ====================

export * from './sdk-agents/nutrition-generation/schema';
