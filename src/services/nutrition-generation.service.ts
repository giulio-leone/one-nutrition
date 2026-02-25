/**
 * Nutrition Generation Service
 *
 * Service layer for executing nutrition generation via OneAgent SDK v3.1.
 * Handles initialization, execution, and streaming.
 */

import { resolve } from 'path';
import { execute } from '@onecoach/one-agent/framework';
import type { ProgressCallback } from '@giulio-leone/agent-contracts';
import { initializeNutritionSchemas } from '../registry';
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
 * Initialize the nutrition generation service
 *
 * @param options.basePath - Path to one-nutrition/src directory
 */
export function initializeNutritionGeneration(options: { basePath?: string } = {}): void {
  if (isInitialized) return;

  // Register schemas with SDK registry
  initializeNutritionSchemas();

  // Use provided basePath or construct from monorepo root
  // process.cwd() in Next.js = /path/to/CoachOne/apps/next
  // We need: /path/to/CoachOne/submodules/one-nutrition/src
  basePath = options.basePath ?? resolve(process.cwd(), '../../submodules/one-nutrition/src');
  isInitialized = true;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Execute nutrition plan generation
 *
 * @param input - Nutrition generation input with user profile, goals, restrictions
 * @param options - Generation options including onProgress callback
 * @returns Generated nutrition plan
 */
export async function generateNutritionPlan(
  input: NutritionGenerationInput,
  options: GenerateOptions = {}
): Promise<NutritionGenerationResult> {
  // Auto-initialize if needed
  if (!isInitialized) {
    initializeNutritionGeneration();
  }

  const startTime = Date.now();

  try {
    // console.log('[NutritionGeneration] Starting generation for user:', input.userId);
    // console.log('[NutritionGeneration] Goals:', input.goals);

    // Execute via SDK with onProgress callback
    const result = await execute<NutritionGenerationOutput>(
      'sdk-agents/nutrition-generation',
      input,
      {
        userId: input.userId,
        basePath,
        onProgress: options.onProgress,
      }
    );

    const durationMs = Date.now() - startTime;

    if (result.success && result.output) {
      // console.log('[NutritionGeneration] Success! Duration:', durationMs, 'ms');
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
      console.error('[NutritionGeneration] Failed:', result.error);
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
    console.error('[NutritionGeneration] Exception:', error);
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

export type { NutritionGenerationInput, NutritionGenerationOutput };
