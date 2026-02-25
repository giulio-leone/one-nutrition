/**
 * Food Generation Service
 *
 * Service layer for executing food generation via OneAgent SDK v3.1.
 */

import { resolve } from 'path';
import { execute } from '@onecoach/one-agent/framework';
import type { ProgressCallback } from '@giulio-leone/agent-contracts';
import { initializeNutritionSchemas } from '../registry';
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

export interface GenerateOptions {
  /** Callback for real-time progress updates */
  onProgress?: ProgressCallback;
}

// =============================================================================
// Service State
// =============================================================================

let isInitialized = false;
let basePath: string = '';

/**
 * Initialize the food generation service
 *
 * @param options.basePath - Path to one-nutrition/src directory
 */
export function initializeFoodGeneration(options: { basePath?: string } = {}): void {
  if (isInitialized) return;

  // Register schemas with SDK registry
  initializeNutritionSchemas();

  // Use provided basePath or construct from monorepo root
  basePath = options.basePath ?? resolve(process.cwd(), '../../submodules/one-nutrition/src');
  isInitialized = true;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Execute food generation
 *
 * @param input - Food generation input
 * @param options - Generation options including onProgress callback
 * @returns Generated foods
 */
export async function generateFoods(
  input: FoodGenerationInput,
  options: GenerateOptions = {}
): Promise<FoodGenerationResult> {
  // Auto-initialize if needed
  if (!isInitialized) {
    initializeFoodGeneration();
  }

  const startTime = Date.now();

  try {
    // console.log('[FoodGeneration] Starting generation for query:', input.description);

    // Execute via SDK with onProgress callback
    const result = await execute<FoodGenerationOutput>('sdk-agents/food-generation', input, {
      basePath,
      onProgress: options.onProgress,
    });

    const durationMs = Date.now() - startTime;

    if (result.success && result.output) {
      // console.log('[FoodGeneration] Success! Duration:', durationMs, 'ms');
      return {
        success: true,
        output: result.output,
        meta: {
          durationMs,
          tokensUsed: result.meta.tokensUsed,
          costUSD: result.meta.costUSD,
        },
      };
    } else {
      console.error('[FoodGeneration] Failed:', result.error);
      return {
        success: false,
        error: {
          message: result.error?.message ?? 'Unknown error',
          code: result.error?.code ?? 'GENERATION_ERROR',
        },
        meta: {
          durationMs,
          tokensUsed: result.meta.tokensUsed,
          costUSD: result.meta.costUSD,
        },
      };
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[FoodGeneration] Exception:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'EXCEPTION',
      },
      meta: {
        durationMs,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  }
}

// =============================================================================
// Re-exports
// =============================================================================

export type { FoodGenerationInput, FoodGenerationOutput };
