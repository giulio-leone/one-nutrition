/**
 * Nutrition Generation Service
 *
 * @deprecated Legacy SDK 3.1 execute() removed. Use Gauss nutrition agent instead.
 */

// Legacy execute() removed — stub that throws
async function execute<T>(_path: string, _input: unknown, _opts?: unknown): Promise<{ success: boolean; output?: T; error?: { message: string; code: string }; meta: { tokensUsed: number; costUSD: number } }> {
  throw new Error('Legacy one-agent SDK execute() removed. Use Gauss nutrition agent instead.');
}
import type { ProgressCallback } from '@giulio-leone/agent-contracts';
import { createLazyService } from '@giulio-leone/lib-shared';
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

const service = createLazyService({
  name: 'NutritionGeneration',
  defaultSubpath: 'submodules/one-nutrition/src',
  setup: () => initializeNutritionSchemas(),
});

/**
 * Initialize the nutrition generation service
 *
 * @param options.basePath - Path to one-nutrition/src directory
 */
export function initializeNutritionGeneration(options: { basePath?: string } = {}): void {
  service.ensureInitialized(options);
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
  const basePath = service.ensureInitialized();

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
