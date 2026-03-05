/**
 * Nutrition Template Service
 *
 * Servizio unificato per gestione template nutrizionali (Meal, Day, Week)
 * Segue principi SOLID: Single Responsibility, Open/Closed, DRY
 * Dependency Inversion: Depends on repository abstractions (Hexagonal)
 */

import { getNutritionTemplateRepo as getTemplateRepo } from '@giulio-leone/core';
import { logger } from '@giulio-leone/lib-core/logger.service';
import { createId } from '@giulio-leone/lib-shared/id-generator';
import type {
  NutritionTemplate,
  NutritionTemplateType,
  Meal,
  NutritionDay,
  NutritionWeek,
} from '@giulio-leone/types';

interface ListTemplatesOptions {
  type?: NutritionTemplateType;
  category?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'lastUsedAt' | 'usageCount' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Validazione template data in base al tipo
 */
function validateTemplateData(
  type: NutritionTemplateType,
  data: Meal | NutritionDay | NutritionWeek
): void {
  switch (type) {
    case 'meal':
      const meal = data as Meal;
      if (!meal.foods || meal.foods.length === 0) {
        throw new Error('Il pasto deve contenere almeno un alimento');
      }
      break;
    case 'day':
      const day = data as NutritionDay;
      if (!day.meals || day.meals.length === 0) {
        throw new Error('Il giorno deve contenere almeno un pasto');
      }
      break;
    case 'week':
      const week = data as NutritionWeek;
      if (!week.days || week.days.length === 0) {
        throw new Error('La settimana deve contenere almeno un giorno');
      }
      break;
    default:
      throw new Error(`Tipo template non valido: ${type}`);
  }
}

export class NutritionTemplateService {
  /**
   * Crea nuovo template
   */
  static async createTemplate(
    userId: string,
    data: {
      type: NutritionTemplateType;
      name: string;
      description?: string;
      category?: string;
      tags?: string[];
      data: Meal | NutritionDay | NutritionWeek;
      isPublic?: boolean;
    }
  ): Promise<NutritionTemplate> {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Il nome del template è obbligatorio');
    }

    if (!['meal', 'day', 'week'].includes(data.type)) {
      throw new Error("Il tipo deve essere 'meal', 'day' o 'week'");
    }

    validateTemplateData(data.type, data.data);

    if (data.tags && data.tags.length > 10) {
      throw new Error('Massimo 10 tags consentiti');
    }

    const repo = getTemplateRepo();
    const template = await repo.create({
      id: createId(),
      userId,
      type: data.type,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      tags: data.tags || [],
      data: data.data,
      isPublic: data.isPublic || false,
    });

    return this.mapToNutritionTemplate(template);
  }

  /**
   * Lista template con filtri avanzati
   */
  static async listTemplates(
    userId: string,
    options: ListTemplatesOptions = {}
  ): Promise<NutritionTemplate[]> {
    const sortBy = options.sortBy || 'lastUsedAt';
    const sortOrder = options.sortOrder || 'desc';

    let orderBy: Record<string, string> | Record<string, string>[];
    switch (sortBy) {
      case 'createdAt':
        orderBy = { createdAt: sortOrder };
        break;
      case 'lastUsedAt':
        orderBy = { lastUsedAt: sortOrder };
        break;
      case 'usageCount':
        orderBy = [{ usageCount: sortOrder }, { createdAt: 'desc' }] as unknown as Record<string, string>;
        break;
      case 'name':
        orderBy = [{ name: sortOrder }, { createdAt: 'desc' }] as unknown as Record<string, string>;
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    try {
      const repo = getTemplateRepo();
      const templates = await repo.findByUser(userId, {
        type: options.type,
        category: options.category,
        tags: options.tags,
        search: options.search && options.search.length >= 2 ? options.search : undefined,
        orderBy: orderBy as Record<string, 'asc' | 'desc'>,
        take: options.limit || 50,
        skip: options.offset || 0,
      });

      return templates.map((t) => this.mapToNutritionTemplate(t));
    } catch (error: unknown) {
      logger.error('[NutritionTemplateService] Error listing templates:', error);
      throw error;
    }
  }

  /**
   * Recupera template per ID
   */
  static async getTemplateById(id: string, userId: string): Promise<NutritionTemplate | null> {
    const repo = getTemplateRepo();
    const template = await repo.findByIdForUser(id, userId);

    if (!template) return null;

    return this.mapToNutritionTemplate(template);
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
      category?: string;
      tags?: string[];
      data?: Meal | NutritionDay | NutritionWeek;
      isPublic?: boolean;
    }
  ): Promise<NutritionTemplate> {
    const repo = getTemplateRepo();
    const existing = await repo.findByIdForUser(id, userId);

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    if (data.data) {
      validateTemplateData(existing.type as NutritionTemplateType, data.data);
    }

    if (data.tags && data.tags.length > 10) {
      throw new Error('Massimo 10 tags consentiti');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.category !== undefined) updateData.category = data.category?.trim() || null;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.data !== undefined) updateData.data = data.data;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

    const updated = await repo.update(id, updateData);

    return this.mapToNutritionTemplate(updated);
  }

  /**
   * Elimina template
   */
  static async deleteTemplate(id: string, userId: string): Promise<void> {
    const repo = getTemplateRepo();
    const existing = await repo.findByIdForUser(id, userId);

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    await repo.delete(id);
  }

  /**
   * Incrementa contatore utilizzi
   */
  static async incrementUsage(id: string): Promise<void> {
    const repo = getTemplateRepo();
    await repo.incrementUsage(id);
  }

  /**
   * Mappa da repository entity a domain NutritionTemplate
   */
  private static mapToNutritionTemplate(
    template: { id: string; type: string; name: string; description: string | null; category: string | null; tags: string[]; data: unknown; isPublic: boolean; usageCount: number; lastUsedAt: Date | null; userId: string | null; createdAt: Date; updatedAt: Date }
  ): NutritionTemplate {
    const logPrefix = '[NutritionTemplateService] mapToNutritionTemplate';
    try {
      return {
        id: template.id,
        type: template.type as NutritionTemplateType,
        name: template.name,
        description: template.description || undefined,
        category: template.category || undefined,
        tags: template.tags || [],
        data: template.data as Meal | NutritionDay | NutritionWeek,
        isPublic: template.isPublic,
        usageCount: template.usageCount,
        lastUsedAt: template.lastUsedAt?.toISOString() || undefined,
        userId: template.userId ?? '',
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      };
    } catch (error: unknown) {
      logger.error(logPrefix, error);
      throw error;
    }
  }
}
