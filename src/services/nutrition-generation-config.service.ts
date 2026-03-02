/**
 * NutritionGenerationConfigService
 *
 * Resolves which AI model to use for nutrition generation.
 * Hexagonal: depends on AIModelService from lib-ai for model resolution.
 */

import { AIModelService } from '@giulio-leone/ai-config';
import { resolveProviderFromModelId } from '@giulio-leone/types/ai';

// --- Types ---

export interface NutritionModelConfig {
  modelId: string;
  provider: string;
  temperature?: number;
}

interface Logger {
  info(step: string, message: string, data?: unknown): void;
  warn(step: string, message: string, data?: unknown): void;
}

// --- Service ---

export class NutritionGenerationConfigService {
  /**
   * Resolve the model configuration for nutrition generation.
   *
   * Priority:
   *  1. Explicit model override from request
   *  2. Operation-level config (ai_operation_configs → nutrition)
   *  3. Global default model
   */
  static async getModelConfig(
    modelOverride?: string,
    logger?: Logger,
  ): Promise<NutritionModelConfig> {
    try {
      const config = await AIModelService.getFeatureModelConfig(
        'nutrition',
        modelOverride,
      );

      const resolved: NutritionModelConfig = {
        modelId: config.modelId,
        provider: resolveProviderFromModelId(config.modelId),
        temperature: 0.7,
      };

      logger?.info('MODEL', 'Model resolved', {
        modelId: resolved.modelId,
        provider: resolved.provider,
        source: modelOverride ? 'override' : 'config',
      });

      return resolved;
    } catch (error) {
      logger?.warn(
        'MODEL',
        'Failed to resolve model config, using fallback',
        { error: error instanceof Error ? error.message : String(error) },
      );

      // Fallback: use a known-good default
      return {
        modelId: 'anthropic/claude-sonnet-4-20250514',
        provider: 'openrouter',
        temperature: 0.7,
      };
    }
  }
}
