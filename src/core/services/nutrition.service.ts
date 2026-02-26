/**
 * Nutrition Service
 *
 * CRUD operations per nutrition plans
 * Implementa INutritionService contract
 */

import { createId, getCurrentTimestamp, storageService } from '@giulio-leone/lib-shared';
import type { IStorageService } from '@giulio-leone/lib-shared';
import type { NutritionPlan } from '@giulio-leone/types';
import type { ApiResponse } from '@giulio-leone/types';
import type { INutritionService } from '@giulio-leone/contracts';

/**
 * Storage key per nutrition plans
 */
const NUTRITION_KEY = 'nutrition_plans';

/**
 * Implementazione Nutrition Service
 */
export class NutritionService implements INutritionService {
  constructor(private storage: IStorageService) {}

  /**
   * Crea un nuovo nutrition plan
   */
  create(plan: Omit<NutritionPlan, 'id' | 'createdAt' | 'updatedAt'>): ApiResponse<NutritionPlan> {
    try {
      const now = getCurrentTimestamp();
      const newPlan: NutritionPlan = {
        ...plan,
        id: createId(),
        createdAt: now,
        updatedAt: now,
        status: plan.status ?? ('DRAFT' as NutritionPlan['status']),
        version: plan.version ?? 1,
        metadata: plan.metadata ?? {},
        weeks: plan.weeks ?? [],
        goals: plan.goals ?? [],
      };

      const plans = this.getAllPlans();
      plans.push(newPlan);
      this.storage.set(NUTRITION_KEY, plans);

      return {
        success: true,
        data: newPlan,
        message: 'Nutrition plan created successfully',
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create nutrition plan',
      };
    }
  }

  /**
   * Aggiorna un nutrition plan
   */
  update(id: string, plan: Partial<NutritionPlan>): ApiResponse<NutritionPlan> {
    try {
      const plans = this.getAllPlans();
      const index = plans.findIndex((p) => p.id === id);

      if (index === -1) {
        return {
          success: false,
          error: 'Nutrition plan not found',
        };
      }

      const existingPlan = plans[index];
      if (!existingPlan) {
        return {
          success: false,
          error: 'Nutrition plan not found',
        };
      }

      const updatedPlan: NutritionPlan = {
        ...existingPlan,
        ...plan,
        name: plan.name ?? existingPlan.name,
        id,
        createdAt: existingPlan.createdAt,
        updatedAt: getCurrentTimestamp(),
      };

      plans[index] = updatedPlan;
      this.storage.set(NUTRITION_KEY, plans);

      return {
        success: true,
        data: updatedPlan,
        message: 'Nutrition plan updated successfully',
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update nutrition plan',
      };
    }
  }

  /**
   * Elimina un nutrition plan
   */
  delete(id: string): ApiResponse<void> {
    try {
      const plans = this.getAllPlans();
      const filteredPlans = plans.filter((p: any) => p.id !== id);

      if (plans.length === filteredPlans.length) {
        return {
          success: false,
          error: 'Nutrition plan not found',
        };
      }

      this.storage.set(NUTRITION_KEY, filteredPlans);

      return {
        success: true,
        message: 'Nutrition plan deleted successfully',
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete nutrition plan',
      };
    }
  }

  /**
   * Ottiene un nutrition plan per id
   */
  get(id: string): ApiResponse<NutritionPlan> {
    try {
      const plans = this.getAllPlans();
      const plan = plans.find((p: any) => p.id === id);

      if (!plan) {
        return {
          success: false,
          error: 'Nutrition plan not found',
        };
      }

      return {
        success: true,
        data: plan,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get nutrition plan',
      };
    }
  }

  /**
   * Ottiene tutti i nutrition plans
   */
  getAll(): ApiResponse<NutritionPlan[]> {
    try {
      const plans = this.getAllPlans();
      return {
        success: true,
        data: plans,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get nutrition plans',
      };
    }
  }

  /**
   * Ottiene nutrition plans per goal
   */
  getByGoal(goalId: string): ApiResponse<NutritionPlan[]> {
    try {
      const plans = this.getAllPlans();
      const filtered = plans.filter((p: any) => p.goals && p.goals.includes(goalId));
      return {
        success: true,
        data: filtered,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get nutrition plans by goal',
      };
    }
  }

  /**
   * Ottiene un nutrition plan creato da un planId di planning (metadata.planId)
   */
  getByPlanId(planId: string): ApiResponse<NutritionPlan | null> {
    try {
      const plans = this.getAllPlans();
      const plan =
        plans.find((p: any) => (p.metadata as Record<string, unknown>)?.planId === planId) || null;
      return { success: true, data: plan };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get nutrition plan by planId',
      };
    }
  }

  /**
   * Helper per ottenere tutti i plans dallo storage
   */
  private getAllPlans(): NutritionPlan[] {
    return this.storage.get<NutritionPlan[]>(NUTRITION_KEY) || [];
  }
}

/**
 * Singleton instance
 */
export const nutritionService: INutritionService = new NutritionService(storageService);
