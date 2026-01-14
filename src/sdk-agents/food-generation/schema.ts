import { z } from 'zod';

// ==================== INPUT ====================

export const FoodGenerationInputSchema = z.object({
  count: z.number().default(5),
  description: z.string().describe('Detailed description of foods to generate'),
  existingFoods: z.array(z.string()).optional().describe('List of existing food names to avoid duplicates'),
  categoryIds: z.array(z.string()).optional().describe('Filter by specific category IDs'),
});

// ==================== OUTPUT ====================

export const GeneratedFoodSchema = z.object({
  name: z.string(),
  description: z.string(),
  macrosPer100g: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
    fiber: z.number().optional(),
  }),
  servingSize: z.number(),
  unit: z.string().default('g'),
  brandName: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
  barcode: z.string().optional(),
});

export const FoodGenerationOutputSchema = z.object({
  foods: z.array(GeneratedFoodSchema),
});

export type FoodGenerationInput = z.infer<typeof FoodGenerationInputSchema>;
export type FoodGenerationOutput = z.infer<typeof FoodGenerationOutputSchema>;
export type GeneratedFood = z.infer<typeof GeneratedFoodSchema>;
