/**
 * NutritionPlannerAgent
 *
 * High-level orchestrator for SSE-streamed nutrition plan generation.
 * Wraps the core `generateNutritionPlan` service with event streaming
 * and model configuration.
 */

import {
  generateNutritionPlan,
  initializeNutritionGeneration,
} from './nutrition-generation.service';
import type { NutritionEventSender } from './nutrition-event-sender';
import type { NutritionModelConfig } from './nutrition-generation-config.service';
import type {
  NutritionGenerationInput,
  NutritionGenerationOutput,
} from '../sdk-agents/nutrition-generation/schema';

// --- Types ---

interface Logger {
  info(step: string, message: string, data?: unknown): void;
  error(step: string, message: string, data?: unknown): void;
}

interface PlannerInput {
  input: NutritionGenerationInput;
  modelConfig: NutritionModelConfig;
  eventSender: NutritionEventSender;
  logger: Logger;
}

interface PlannerResult {
  plan: NutritionGenerationOutput['plan'];
  mealsComposed: number;
  failedMeals: number;
  generationTimeMs: number;
}

// --- Agent ---

export class NutritionPlannerAgent {
  /**
   * Execute nutrition plan generation with SSE event streaming.
   */
  static async execute({
    input,
    modelConfig,
    eventSender,
    logger,
  }: PlannerInput): Promise<PlannerResult> {
    const startTime = Date.now();

    // Ensure SDK is initialized
    initializeNutritionGeneration();

    // Map input to SDK format
    const sdkInput = {
      userId: input.userId,
      userProfile: input.userProfile,
      goals: input.goals,
      restrictions: input.restrictions,
      foodCatalog: undefined,
    };

    logger.info('GENERATE', 'Starting NutritionPlannerAgent', {
      modelId: modelConfig.modelId,
      provider: modelConfig.provider,
    });

    // Progress tracking
    let stepIndex = 0;

    const result = await generateNutritionPlan(sdkInput, {
      onProgress: (event) => {
        stepIndex++;
        const progress = Math.min(10 + (stepIndex / 10) * 80, 90);
        eventSender.sendAgentProgress(
          'nutrition_planner',
          Math.round(progress),
          event.message,
        );
      },
    });

    const generationTimeMs = Date.now() - startTime;

    if (!result.success || !result.output) {
      const errorMsg =
        result.error?.message ?? 'Nutrition generation failed';
      logger.error('GENERATE', errorMsg);
      throw new Error(errorMsg);
    }

    const plan = result.output.plan;

    // Count composed/failed meals
    let mealsComposed = 0;
    let failedMeals = 0;
    for (const pattern of plan.dayPatterns ?? []) {
      for (const meal of pattern.meals ?? []) {
        if (meal.foods && meal.foods.length > 0) {
          mealsComposed++;
        } else {
          failedMeals++;
        }
      }
    }

    logger.info('GENERATE', 'Generation completed', {
      mealsComposed,
      failedMeals,
      generationTimeMs,
      tokensUsed: result.meta.tokensUsed,
    });

    return {
      plan,
      mealsComposed,
      failedMeals,
      generationTimeMs,
    };
  }
}
