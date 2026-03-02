/**
 * Food Generation Service
 *
 * @deprecated Legacy SDK removed. Use Gauss NutritionAgent via supervisor delegation.
 * This file is kept for type exports only.
 */

import type {
  FoodGenerationInput,
  FoodGenerationOutput,
} from '../sdk-agents/food-generation/schema';

// =============================================================================
// Types
// =============================================================================

export interface FoodGenerationResult {
  success: boolean;
  output?: FoodGenerationOutput;
  error?: {
    message: string;
    code: string;
  };
  meta: {
    durationMs: number;
    tokensUsed: number;
    costUSD: number;
  };
}

// =============================================================================
// Main Function (deprecated — throws at runtime)
// =============================================================================

/**
 * @deprecated Use Gauss NutritionAgent via supervisor delegation instead.
 */
export async function generateFoods(
  _input: FoodGenerationInput,
  _options?: { onProgress?: unknown }
): Promise<FoodGenerationResult> {
  throw new Error(
    '[FoodGeneration] Legacy SDK removed. Use Gauss NutritionAgent via CoachNetwork supervisor.'
  );
}

// =============================================================================
// Re-exports
// =============================================================================

export type { FoodGenerationInput, FoodGenerationOutput };
