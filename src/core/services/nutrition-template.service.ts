/**
 * Nutrition Template Service
 *
 * Servizio unificato per gestione template nutrizionali (Meal, Day, Week)
 * Segue principi SOLID: Single Responsibility, Open/Closed, DRY
 */

import { prisma } from '@onecoach/lib-core';

import { logger } from '@onecoach/lib-core';
import { Prisma } from '@prisma/client';
import { createId } from '@onecoach/lib-shared/id-generator';
import { toPrismaJsonValue } from '@onecoach/lib-shared';
import type {
  NutritionTemplate,
  NutritionTemplateType,
  Meal,
  NutritionDay,
  NutritionWeek,
} from '@onecoach/types';

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
    // Validazione nome
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Il nome del template è obbligatorio');
    }

    // Validazione tipo
    if (!['meal', 'day', 'week'].includes(data.type)) {
      throw new Error("Il tipo deve essere 'meal', 'day' o 'week'");
    }

    // Validazione data
    validateTemplateData(data.type, data.data);

    // Validazione tags (max 10)
    if (data.tags && data.tags.length > 10) {
      throw new Error('Massimo 10 tags consentiti');
    }

    const template = await prisma.nutrition_templates.create({
      data: {
        id: createId(),
        userId,
        type: data.type,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        tags: data.tags || [],
        data: toPrismaJsonValue(data.data as Record<string, unknown>),
        isPublic: data.isPublic || false,
        usageCount: 0,
        lastUsedAt: null,
      },
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
    const logPrefix = '[NutritionTemplateService] listTemplates error';
    const where: Prisma.nutrition_templatesWhereInput = {
      userId,
    };

    // Filtro tipo
    if (options.type) {
      where.type = options.type;
    }

    // Filtro categoria
    if (options.category) {
      where.category = options.category;
    }

    // Filtro tags (almeno uno deve matchare)
    if (options.tags && options.tags.length > 0) {
      where.tags = {
        hasSome: options.tags,
      };
    }

    // Ricerca su nome/descrizione
    if (options.search && options.search.length >= 2) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { tags: { has: options.search } },
      ];
    }

    // Ordinamento
    let orderBy:
      | Prisma.nutrition_templatesOrderByWithRelationInput
      | Prisma.nutrition_templatesOrderByWithRelationInput[];
    const sortBy = options.sortBy || 'lastUsedAt';
    const sortOrder = options.sortOrder || 'desc';

    switch (sortBy) {
      case 'createdAt':
        orderBy = { createdAt: sortOrder };
        break;
      case 'lastUsedAt':
        // Usare ordinamento singolo, Prisma gestisce null automaticamente
        // Per desc: null vengono alla fine, per asc: null vengono all'inizio
        orderBy = { lastUsedAt: sortOrder };
        break;
      case 'usageCount':
        orderBy = [{ usageCount: sortOrder }, { createdAt: 'desc' }];
        break;
      case 'name':
        orderBy = [{ name: sortOrder }, { createdAt: 'desc' }];
        break;
      default:
        // Default: ordina per createdAt
        orderBy = { createdAt: 'desc' };
    }

    try {
      const templates = await prisma.nutrition_templates.findMany({
        where,
        orderBy,
        take: options.limit || 50,
        skip: options.offset || 0,
      });

      return templates.map((t: any) => this.mapToNutritionTemplate(t));
    } catch (error: unknown) {
      logger.error(logPrefix, error);
      logger.error('[NutritionTemplateService] where clause:', JSON.stringify(where, null, 2));
      logger.error('[NutritionTemplateService] orderBy:', JSON.stringify(orderBy, null, 2));
      logger.error('[NutritionTemplateService] options:', JSON.stringify(options, null, 2));
      throw error;
    }
  }

  /**
   * Recupera template per ID
   */
  static async getTemplateById(id: string, userId: string): Promise<NutritionTemplate | null> {
    const template = await prisma.nutrition_templates.findFirst({
      where: {
        id,
        OR: [{ userId }, { isPublic: true }],
      },
    });

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
    // Verifica esistenza e proprietà
    const existing = await prisma.nutrition_templates.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    // Validazione data se fornita
    if (data.data) {
      validateTemplateData(existing.type, data.data);
    }

    // Validazione tags
    if (data.tags && data.tags.length > 10) {
      throw new Error('Massimo 10 tags consentiti');
    }

    const updateData: Prisma.nutrition_templatesUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.category !== undefined) {
      updateData.category = data.category?.trim() || null;
    }
    if (data.tags !== undefined) {
      updateData.tags = data.tags;
    }
    if (data.data !== undefined) {
      updateData.data = toPrismaJsonValue(data.data as Record<string, unknown>);
    }
    if (data.isPublic !== undefined) {
      updateData.isPublic = data.isPublic;
    }

    const updated = await prisma.nutrition_templates.update({
      where: { id },
      data: updateData,
    });

    return this.mapToNutritionTemplate(updated);
  }

  /**
   * Elimina template
   */
  static async deleteTemplate(id: string, userId: string): Promise<void> {
    const existing = await prisma.nutrition_templates.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    await prisma.nutrition_templates.delete({
      where: { id },
    });
  }

  /**
   * Incrementa contatore utilizzi
   */
  static async incrementUsage(id: string): Promise<void> {
    await prisma.nutrition_templates.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Mappa da Prisma model a NutritionTemplate
   */
  private static mapToNutritionTemplate(
    template: Prisma.nutrition_templatesGetPayload<{ include: {} }>
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
      logger.error('[NutritionTemplateService] template data:', JSON.stringify(template, null, 2));
      throw error;
    }
  }
}
