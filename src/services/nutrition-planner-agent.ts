/**
 * NutritionPlannerAgent
 *
 * @deprecated Legacy orchestrator removed. Nutrition planning is now handled
 * by Gauss NutritionAgent via the CoachNetwork supervisor delegation.
 */

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
   * @deprecated Use Gauss NutritionAgent via CoachNetwork supervisor instead.
   */
  static async execute(_input: PlannerInput): Promise<PlannerResult> {
    throw new Error(
      '[NutritionPlannerAgent] Legacy SDK removed. Use Gauss NutritionAgent via CoachNetwork supervisor.'
    );
  }
}
