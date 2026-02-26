/**
 * Meal Template Service
 *
 * Servizio per gestione template pasti (meals) salvabili e riutilizzabili
 * Segue pattern FoodService per consistenza
 */

import { prisma } from '@giulio-leone/lib-core';
import { Prisma } from '@prisma/client';
import { createId, toPrismaJsonValue } from '@giulio-leone/lib-shared';
import type { MealTemplate, Meal } from '@giulio-leone/types';

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

    const template = await prisma.meal_templates.create({
      data: {
        id: createId(),
        userId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        meal: toPrismaJsonValue(data.meal as Record<string, unknown>),
        tags: data.tags || [],
        isPublic: data.isPublic || false,
      },
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
    const where: Prisma.meal_templatesWhereInput = {
      userId,
    };

    if (options?.search) {
      where.name = {
        contains: options.search,
        mode: 'insensitive',
      };
    }

    if (options?.tags && options.tags.length > 0) {
      where.tags = {
        hasSome: options.tags,
      };
    }

    const templates = await prisma.meal_templates.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return templates.map((t: any) => this.mapToMealTemplate(t));
  }

  /**
   * Recupera template per ID
   */
  static async getTemplateById(id: string, userId: string): Promise<MealTemplate | null> {
    const template = await prisma.meal_templates.findFirst({
      where: {
        id,
        OR: [{ userId }, { isPublic: true }],
      },
    });

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
    const existing = await prisma.meal_templates.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    if (data.meal && (!data.meal.foods || data.meal.foods.length === 0)) {
      throw new Error('Il pasto deve contenere almeno un alimento');
    }

    const updateData: Prisma.meal_templatesUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.meal !== undefined) {
      updateData.meal = toPrismaJsonValue(data.meal as Record<string, unknown>);
    }
    if (data.tags !== undefined) {
      updateData.tags = data.tags;
    }
    if (data.isPublic !== undefined) {
      updateData.isPublic = data.isPublic;
    }

    const updated = await prisma.meal_templates.update({
      where: { id },
      data: updateData,
    });

    return this.mapToMealTemplate(updated);
  }

  /**
   * Elimina template
   */
  static async deleteTemplate(id: string, userId: string): Promise<void> {
    const existing = await prisma.meal_templates.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      throw new Error('Template non trovato o non autorizzato');
    }

    await prisma.meal_templates.delete({
      where: { id },
    });
  }

  /**
   * Mappa da Prisma model a MealTemplate
   */
  private static mapToMealTemplate(
    template: Prisma.meal_templatesGetPayload<{ include: {} }>
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
