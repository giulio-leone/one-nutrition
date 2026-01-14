/**
 * Validator Worker Schema
 */

import { z } from 'zod';
import {
  NutritionGoalsSchema,
  MealTargetSchema,
  MacrosSchema,
  DayPatternSchema,
} from '../../schema';

// ==================== INPUT ====================

export const ValidatorInputSchema = z.object({
  patterns: z.array(DayPatternSchema),
  dailyMacros: MacrosSchema,
  goals: NutritionGoalsSchema,
  mealTargets: z.array(MealTargetSchema),
});

// ==================== OUTPUT ====================

const ValidationIssueSchema = z.object({
  type: z.enum(['error', 'warning']),
  code: z.string(),
  message: z.string(),
  patternCode: z.string().optional(),
  mealName: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ValidatorOutputSchema = z.object({
  valid: z.boolean().describe('Whether the plan passes validation'),
  score: z.number().min(0).max(100).describe('Quality score 0-100'),
  issues: z.array(ValidationIssueSchema),
  macroDeviation: z.object({
    calories: z.number().describe('Percentage deviation from target'),
    protein: z.number(),
    carbs: z.number(),
    fats: z.number(),
  }),
  summary: z.string().describe('Human-readable validation summary'),
});

// ==================== TYPE EXPORTS ====================

export type ValidatorInput = z.infer<typeof ValidatorInputSchema>;
export type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
