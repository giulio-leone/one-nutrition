/**
 * Meal Template Service
 *
 * Servizio per gestione template pasti (meals) salvabili e riutilizzabili
 * Segue pattern FoodService per consistenza
 */

import { ServiceRegistry, REPO_TOKENS } from '@giulio-leone/core';
import type { IMealTemplateRepository, MealTemplateEntity, UpdateMealTemplateInput } from '@giulio-leone/core/repositories';
import { createId } from '@giulio-leone/lib-shared';
import type { MealTemplate, Meal } from '@giulio-leone/types';

const getMealTemplateRepo = () =>
  ServiceRegistry.getInstance().resolve<IMealTemplateRepository>(REPO_TOKENS.MEAL_TEMPLATE);

export class MealTemplateService {
  /**
   * Crea nuovo template pasto
   */
  static async createTemplate(
    userId: string,
    data: {
      name: string;
      description?: string;
      meal: Meal;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<MealTemplate> {
    if (!data.meal.foods || data.meal.foods.length === 0) {
      throw new Error('Il pasto deve contenere almeno un alimento');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Il nome del template è obbligatorio');
    }

    const template = await getMealTemplateRepo().create({
      id: createId(),
      userId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      meal: data.meal,
      tags: data.tags || [],
      isPublic: data.isPublic || false,
    });

    return this.mapToMealTemplate(template);
  }

  /**
   * Lista template dell'utente
   */
  static async listTemplates(
    userId: string,
    options?: {
      search?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<MealTemplate[]> {
    const templates = await getMealTemplateRepo().findByUser(userId, {
      search: options?.search,
      tags: options?.tags,
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });

    return templates.map((t) => this.mapToMealTemplate(t));
  }

  /**
   * Recupera template per ID
   */
  static async getTemplateById(id: string, userId: string): Promise<MealTemplate | null> {
    const template = await getMealTemplateRepo().findByIdOrPublic(id, userId);

    if (!template) return null;

    return this.mapToMealTemplate(template);
  }

  /**
   * Aggiorna template
   */
  static async updateTemplate(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      meal?: Meal;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<MealTemplate> {
    const existing = await getMealTemplateRepo().findByIdForUser(id, userId);

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    if (data.meal && (!data.meal.foods || data.meal.foods.length === 0)) {
      throw new Error('Il pasto deve contenere almeno un alimento');
    }

    const updateData: UpdateMealTemplateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.meal !== undefined) {
      updateData.meal = data.meal;
    }
    if (data.tags !== undefined) {
      updateData.tags = data.tags;
    }
    if (data.isPublic !== undefined) {
      updateData.isPublic = data.isPublic;
    }

    const updated = await getMealTemplateRepo().update(id, updateData);

    return this.mapToMealTemplate(updated);
  }

  /**
   * Elimina template
   */
  static async deleteTemplate(id: string, userId: string): Promise<void> {
    const existing = await getMealTemplateRepo().findByIdForUser(id, userId);

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    await getMealTemplateRepo().delete(id);
  }

  /**
   * Mappa da Prisma model a MealTemplate
   */
  private static mapToMealTemplate(
    template: MealTemplateEntity
  ): MealTemplate {
    return {
      id: template.id,
      name: template.name,
      description: template.description || undefined,
      meal: template.meal as Meal,
      tags: template.tags,
      isPublic: template.isPublic,
      userId: template.userId ?? '',
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }
}
