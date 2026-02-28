/**
 * Nutrition Generation Tools
 *
 * Tools available to nutrition agents for composing meals.
 * AI SDK v6 format: { description, inputSchema, execute }
 */

import { z } from 'zod';

// ==================== MOCK FOOD CATALOG ====================

const MOCK_FOODS = [
  {
    id: 'food_chicken_breast',
    name: 'Petto di pollo',
    category: 'protein',
    macrosPer100g: { calories: 165, protein: 31, carbs: 0, fats: 3.6 },
    tags: ['lean', 'poultry'],
  },
  {
    id: 'food_salmon',
    name: 'Salmone',
    category: 'protein',
    macrosPer100g: { calories: 208, protein: 20, carbs: 0, fats: 13 },
    tags: ['fish', 'omega3'],
  },
  {
    id: 'food_eggs',
    name: 'Uova intere',
    category: 'protein',
    macrosPer100g: { calories: 155, protein: 13, carbs: 1, fats: 11 },
    tags: ['breakfast', 'versatile'],
  },
  {
    id: 'food_greek_yogurt',
    name: 'Yogurt greco',
    category: 'dairy',
    macrosPer100g: { calories: 97, protein: 9, carbs: 4, fats: 5 },
    tags: ['breakfast', 'snack', 'dairy'],
  },
  {
    id: 'food_rice',
    name: 'Riso basmati',
    category: 'carbs',
    macrosPer100g: { calories: 130, protein: 2.7, carbs: 28, fats: 0.3 },
    tags: ['grain', 'gluten-free'],
  },
  {
    id: 'food_pasta',
    name: 'Pasta integrale',
    category: 'carbs',
    macrosPer100g: { calories: 124, protein: 5, carbs: 25, fats: 1 },
    tags: ['grain', 'fiber'],
  },
  {
    id: 'food_oats',
    name: "Fiocchi d'avena",
    category: 'carbs',
    macrosPer100g: { calories: 389, protein: 17, carbs: 66, fats: 7 },
    tags: ['breakfast', 'fiber'],
  },
  {
    id: 'food_bread_whole',
    name: 'Pane integrale',
    category: 'carbs',
    macrosPer100g: { calories: 250, protein: 10, carbs: 45, fats: 3 },
    tags: ['breakfast', 'fiber'],
  },
  {
    id: 'food_banana',
    name: 'Banana',
    category: 'fruit',
    macrosPer100g: { calories: 89, protein: 1, carbs: 23, fats: 0.3 },
    tags: ['fruit', 'snack', 'fast-carb'],
  },
  {
    id: 'food_apple',
    name: 'Mela',
    category: 'fruit',
    macrosPer100g: { calories: 52, protein: 0.3, carbs: 14, fats: 0.2 },
    tags: ['fruit', 'snack'],
  },
  {
    id: 'food_olive_oil',
    name: 'Olio extravergine di oliva',
    category: 'fats',
    macrosPer100g: { calories: 884, protein: 0, carbs: 0, fats: 100 },
    tags: ['healthy-fat', 'cooking'],
  },
  {
    id: 'food_almonds',
    name: 'Mandorle',
    category: 'fats',
    macrosPer100g: { calories: 579, protein: 21, carbs: 22, fats: 50 },
    tags: ['nuts', 'snack', 'healthy-fat'],
  },
  {
    id: 'food_avocado',
    name: 'Avocado',
    category: 'fats',
    macrosPer100g: { calories: 160, protein: 2, carbs: 9, fats: 15 },
    tags: ['healthy-fat', 'fruit'],
  },
  {
    id: 'food_broccoli',
    name: 'Broccoli',
    category: 'vegetables',
    macrosPer100g: { calories: 34, protein: 2.8, carbs: 7, fats: 0.4 },
    tags: ['vegetable', 'fiber'],
  },
  {
    id: 'food_spinach',
    name: 'Spinaci',
    category: 'vegetables',
    macrosPer100g: { calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4 },
    tags: ['vegetable', 'iron'],
  },
  {
    id: 'food_lentils',
    name: 'Lenticchie cotte',
    category: 'legumes',
    macrosPer100g: { calories: 116, protein: 9, carbs: 20, fats: 0.4 },
    tags: ['legume', 'protein', 'fiber'],
  },
  {
    id: 'food_chickpeas',
    name: 'Ceci cotti',
    category: 'legumes',
    macrosPer100g: { calories: 164, protein: 9, carbs: 27, fats: 2.6 },
    tags: ['legume', 'protein', 'fiber'],
  },
  {
    id: 'food_cottage_cheese',
    name: 'Fiocchi di latte',
    category: 'dairy',
    macrosPer100g: { calories: 98, protein: 11, carbs: 3, fats: 4 },
    tags: ['dairy', 'protein', 'snack'],
  },
];

// ==================== TOOLS ====================

/**
 * Get food catalog - returns available foods
 */
export const getFoodCatalog = {
  description: 'Get the available food catalog with macro information per 100g',
  inputSchema: z.object({
    category: z.string().optional().describe('Filter by category'),
    tags: z.array(z.string()).optional().describe('Filter by tags'),
  }),
  execute: async ({ category, tags }: { category?: string; tags?: string[] }): Promise<string> => {
    let foods = [...MOCK_FOODS];

    if (category) {
      foods = foods.filter((f: any) => f.category === category);
    }

    if (tags && tags.length > 0) {
      foods = foods.filter((f: any) => tags.some((tag) => f.tags.includes(tag)));
    }

    return JSON.stringify({
      count: foods.length,
      foods: foods.map((f: any) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        macrosPer100g: f.macrosPer100g,
        tags: f.tags,
      })),
    });
  },
};

/**
 * Calculate macros for a given quantity
 */
export const calculateFoodMacros = {
  description: 'Calculate macros for a specific quantity of food',
  inputSchema: z.object({
    foodId: z.string().describe('Food ID from catalog'),
    quantity: z.number().describe('Quantity in grams'),
  }),
  execute: async ({ foodId, quantity }: { foodId: string; quantity: number }): Promise<string> => {
    const food = MOCK_FOODS.find((f: any) => f.id === foodId);
    if (!food) {
      return JSON.stringify({ error: `Food ${foodId} not found` });
    }

    const multiplier = quantity / 100;
    return JSON.stringify({
      foodId,
      name: food.name,
      quantity,
      unit: 'g',
      macros: {
        calories: Math.round(food.macrosPer100g.calories * multiplier),
        protein: Math.round(food.macrosPer100g.protein * multiplier * 10) / 10,
        carbs: Math.round(food.macrosPer100g.carbs * multiplier * 10) / 10,
        fats: Math.round(food.macrosPer100g.fats * multiplier * 10) / 10,
      },
    });
  },
};

/**
 * Validate a meal composition
 */
export const validateMeal = {
  description: 'Validate a meal composition against target macros',
  inputSchema: z.object({
    targetMacros: z.object({
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fats: z.number(),
    }),
    foods: z.array(
      z.object({
        foodId: z.string(),
        quantity: z.number(),
      })
    ),
  }),
  execute: async ({
    targetMacros,
    foods,
  }: {
    targetMacros: { calories: number; protein: number; carbs: number; fats: number };
    foods: Array<{ foodId: string; quantity: number }>;
  }): Promise<string> => {
    let totalMacros = { calories: 0, protein: 0, carbs: 0, fats: 0 };

    for (const item of foods) {
      const food = MOCK_FOODS.find((f: any) => f.id === item.foodId);
      if (!food) {
        return JSON.stringify({ valid: false, error: `Food ${item.foodId} not found` });
      }

      const multiplier = item.quantity / 100;
      totalMacros.calories += food.macrosPer100g.calories * multiplier;
      totalMacros.protein += food.macrosPer100g.protein * multiplier;
      totalMacros.carbs += food.macrosPer100g.carbs * multiplier;
      totalMacros.fats += food.macrosPer100g.fats * multiplier;
    }

    // Round
    totalMacros = {
      calories: Math.round(totalMacros.calories),
      protein: Math.round(totalMacros.protein),
      carbs: Math.round(totalMacros.carbs),
      fats: Math.round(totalMacros.fats),
    };

    // Calculate deviations
    const deviation = {
      calories: ((totalMacros.calories - targetMacros.calories) / targetMacros.calories) * 100,
      protein: ((totalMacros.protein - targetMacros.protein) / targetMacros.protein) * 100,
      carbs: ((totalMacros.carbs - targetMacros.carbs) / targetMacros.carbs) * 100,
      fats: ((totalMacros.fats - targetMacros.fats) / targetMacros.fats) * 100,
    };

    const valid =
      Math.abs(deviation.calories) <= 5 &&
      Math.abs(deviation.protein) <= 10 &&
      Math.abs(deviation.carbs) <= 15 &&
      Math.abs(deviation.fats) <= 15;

    return JSON.stringify({
      valid,
      actualMacros: totalMacros,
      targetMacros,
      deviation: {
        calories: `${deviation.calories.toFixed(1)}%`,
        protein: `${deviation.protein.toFixed(1)}%`,
        carbs: `${deviation.carbs.toFixed(1)}%`,
        fats: `${deviation.fats.toFixed(1)}%`,
      },
      suggestion: valid ? 'Meal is within tolerance!' : `Adjust quantities to fix deviations`,
    });
  },
};

// ==================== EXPORTS ====================

export const nutritionTools = {
  getFoodCatalog,
  calculateFoodMacros,
  validateMeal,
};
