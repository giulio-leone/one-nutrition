import { z } from 'zod';
import { getNutritionRepo as getNutritionPlanRepo } from '@giulio-leone/core';
import type { NutritionPlan as NutritionPlanEntity } from '@giulio-leone/core/repositories';
import type {
  AIParseContext,
  ImportOptions,
  BaseImportResult,
  ImportFileType,
} from '@giulio-leone/lib-shared/import-core';
import { normalizeAgentPayload, preparePlanForPersistence } from '../transformers/plan-transform';
import type { ImportedNutritionPlan } from '../helpers/imported-nutrition.schema';
import { ImportedNutritionPlanSchema } from '../helpers/imported-nutrition.schema';

async function getImportCore() {
  return import('@giulio-leone/lib-shared/import-core');
}

const NutritionImportOptionsSchema = z.object({
  mode: z.enum(['auto', 'review']).default('auto'),
  locale: z.string().optional(),
});

export type NutritionImportOptions = z.infer<typeof NutritionImportOptionsSchema>;

/**
 * Result of the nutrition import process
 */
export interface NutritionImportResult extends BaseImportResult {
  planId?: string;
  plan?: NutritionPlanEntity;
  parseResult?: ImportedNutritionPlan;
}

export interface NutritionImportProcessed {
  normalized: ReturnType<typeof normalizeAgentPayload>;
  persistenceData: ReturnType<typeof preparePlanForPersistence>;
  parseResult: ImportedNutritionPlan;
}

/**
 * Service for importing nutrition plans.
 * Extends BaseImportService to use shared orchestration logic.
 */
export class NutritionImportService extends BaseImportService<
  ImportedNutritionPlan,
  NutritionImportProcessed,
  NutritionImportResult
> {
  protected getLoggerName(): string {
    return 'NutritionImport';
  }

  protected buildPrompt(_options?: Partial<ImportOptions>): string {
    return `Analizza il file allegato (piano nutrizionale) e restituisci SOLO JSON che rispetti esattamente lo schema seguente, senza testo extra:
{
  "name": string,
  "description": string,
  "goals": string[],
  "durationWeeks": number,
  "targetMacros": { "calories": number, "protein": number, "carbs": number, "fats": number, "fiber": number },
  "weeks": [
    {
      "weekNumber": number,
      "days": [
        {
          "dayNumber": number,
          "dayName": string,
          "meals": [
            {
              "name": string,
              "type": string,
              "time": string,
              "foods": [
                {
                  "foodItemId": string | null,
                  "name": string,
                  "quantity": number,
                  "unit": string,
                  "macros": { "calories": number, "protein": number, "carbs": number, "fats": number, "fiber": number }
                }
              ],
              "totalMacros": { "calories": number, "protein": number, "carbs": number, "fats": number, "fiber": number }
            }
          ],
          "totalMacros": { "calories": number, "protein": number, "carbs": number, "fats": number, "fiber": number }
        }
      ]
    }
  ],
  "restrictions": string[],
  "preferences": string[],
  "status": "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
}
Regole:
- Usa valori numerici reali (niente stringhe tipo "20g").
- Calcola calorie con Atwater: 4*carbs + 4*protein + 9*fats.
- Mantieni coerenza: somma dei cibi = macros del pasto; somma pasti = macros giorno.
- Usa solo cibi plausibili; se non trovi un foodItemId lascia name e macros valorizzati.`;
  }

  protected async processParsed(
    parsed: ImportedNutritionPlan,
    userId: string,
    options?: Partial<ImportOptions>
  ): Promise<NutritionImportProcessed> {
    NutritionImportOptionsSchema.parse(options ?? {});

    const normalized = normalizeAgentPayload(parsed, {
      userId,
      status: 'ACTIVE',
    });

    const persistenceData = preparePlanForPersistence(normalized);

    // Pass both the parsed data and the persistence data to the persist step
    // The persist step needs userId/id from normalized, and db-ready objects from persistenceData
    return { normalized, persistenceData, parseResult: parsed };
  }

  protected async persist(
    processed: NutritionImportProcessed,
    userId: string
  ): Promise<Partial<NutritionImportResult>> {
    const { normalized, persistenceData, parseResult } = processed;

    const plan = await getNutritionPlanRepo().createFull({
      id: normalized.id,
      userId,
      name: persistenceData.name,
      description: persistenceData.description,
      goals: persistenceData.goals,
      durationWeeks: persistenceData.durationWeeks,
      targetMacros: persistenceData.targetMacros,
      userProfile: persistenceData.userProfile,
      personalizedPlan: persistenceData.personalizedPlan,
      adaptations: persistenceData.adaptations,
      weeks: persistenceData.weeks,
      restrictions: persistenceData.restrictions,
      preferences: persistenceData.preferences,
      status: persistenceData.status,
      metadata: persistenceData.metadata,
    });

    return {
      planId: plan.id,
      plan,
      parseResult,
    };
  }

  protected createErrorResult(errors: string[]): Partial<NutritionImportResult> {
    return {
      success: false,
      errors,
    };
  }
}

export function createNutritionAIContext(): AIParseContext<ImportedNutritionPlan> {
  return {
    parseWithAI: (content: string, mimeType: string, prompt: string, userId?: string) => {
      let fileType: ImportFileType = 'document';
      if (mimeType.startsWith('image/')) fileType = 'image';
      if (mimeType === 'application/pdf') fileType = 'pdf';
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) fileType = 'spreadsheet';

      if (!userId) throw new Error('UserId richiesto per il parsing AI');

      return parseWithVisionAI<ImportedNutritionPlan>({
        contentBase64: content,
        mimeType,
        prompt,
        schema: ImportedNutritionPlanSchema as any,
        userId,
        fileType,
      });
    },
  };
}
