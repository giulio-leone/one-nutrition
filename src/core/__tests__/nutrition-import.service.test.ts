import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NutritionImportService } from '../nutrition-import.service';
import type { AIParseContext } from '@giulio-leone/lib-import-core';
import type { ImportedNutritionPlan } from '../helpers/imported-nutrition.schema';

vi.mock('@giulio-leone/lib-core', () => ({
  prisma: {
    nutrition_plans: {
      create: vi.fn().mockResolvedValue({ id: 'plan_1' }),
    },
  },
}));

describe('NutritionImportService', () => {
  const aiContext: AIParseContext<ImportedNutritionPlan> = {
    parseWithAI: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('importa un piano nutrizionale e restituisce successo', async () => {
    (aiContext.parseWithAI as any).mockResolvedValue({
      name: 'Plan',
      goals: ['maintenance'],
      durationWeeks: 1,
      targetMacros: { calories: 2000, protein: 150, carbs: 200, fats: 70, fiber: 25 },
      weeks: [
        {
          weekNumber: 1,
          days: [
            {
              dayNumber: 1,
              meals: [
                {
                  name: 'Meal',
                  foods: [
                    {
                      name: 'Chicken',
                      quantity: 100,
                      unit: 'g',
                      macros: { calories: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0 },
                    },
                  ],
                  totalMacros: { calories: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0 },
                },
              ],
              totalMacros: { calories: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0 },
            },
          ],
        },
      ],
      restrictions: [],
      preferences: [],
      status: 'ACTIVE',
    } as ImportedNutritionPlan);

    const service = new NutritionImportService({
      aiContext,
      context: { userId: 'user_1', requestId: 'test-req-1' },
    });

    const result = await service.import(
      [
        {
          name: 'plan.pdf',
          mimeType: 'application/pdf',
          content: 'YmFzZTY0',
        },
      ],
      'user_1',
      { mode: 'auto' }
    );

    expect(result.success).toBe(true);
    expect(result.planId).toBe('plan_1');
  });
});
