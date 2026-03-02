/**
 * Nutrition Generation Service
 *
 * @deprecated Legacy SDK removed. Use Gauss NutritionAgent via supervisor delegation.
 * This file is kept for type exports only.
 */

import type {
  NutritionGenerationInput,
  NutritionGenerationOutput,
} from '../sdk-agents/nutrition-generation/schema';

// =============================================================================
// Types
// =============================================================================

export interface NutritionGenerationResult {
  success: boolean;
  output?: NutritionGenerationOutput;
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
export async function generateNutritionPlan(
  _input: NutritionGenerationInput,
  _options?: { onProgress?: unknown }
): Promise<NutritionGenerationResult> {
  throw new Error(
    '[NutritionGeneration] Legacy SDK removed. Use Gauss NutritionAgent via CoachNetwork supervisor.'
  );
}

// =============================================================================
// Re-exports
// =============================================================================

export type { NutritionGenerationInput, NutritionGenerationOutput };
