/**
 * Nutrition Summary Normalizer
 *
 * Normalizer leggero per le liste di piani nutrizionali.
 * Esclude i campi JSON pesanti (weeks, personalizedPlan, adaptations) per migliorare le performance.
 */

import { NutritionStatus } from '@onecoach/types';
import { parseNutritionStatus } from '../transformers/plan-transform';

/**
 * Interfaccia per il riepilogo del piano nutrizionale
 */
export interface NutritionPlanSummary {
  id: string;
  name: string;
  description: string;
  goals: string[];
  durationWeeks: number;
  status: NutritionStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

/**
 * Interfaccia Prisma per il riepilogo (ottimizzata con select)
 */
export interface PrismaNutritionPlanSummary {
  id: string;
  name: string;
  description: string | null;
  goals: unknown; // JSON
  durationWeeks: number;
  status: NutritionStatus;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

/**
 * Normalizza un piano nutrizionale per la visualizzazione in lista.
 * Evita il parsing di campi JSON pesanti.
 */
export function normalizeNutritionPlanSummary(
  plan: PrismaNutritionPlanSummary
): NutritionPlanSummary {
  const goals = Array.isArray(plan.goals)
    ? plan.goals.filter((g): g is string => typeof g === 'string')
    : ['MAINTENANCE'];

  return {
    id: plan.id,
    name: plan.name || 'Untitled Plan',
    description: plan.description || '',
    goals: goals.length > 0 ? goals : ['MAINTENANCE'],
    durationWeeks: plan.durationWeeks || 1,
    status: parseNutritionStatus(plan.status),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    userId: plan.userId,
  };
}
