/**
 * ShoppingGeneratorService
 *
 * Generates a shopping list from a nutrition plan using AI.
 * Creates an agenda_project of type SHOPPING with shopping items as tasks.
 *
 * Hexagonal: depends on Prisma for persistence, AI SDK for generation.
 */

import { prisma } from '@giulio-leone/lib-core';
import { createId } from '@giulio-leone/lib-shared';
import type { ShoppingPreferences } from './shopping-preferences.schema';

// --- Types ---

interface ShoppingItem {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  notes?: string;
}

// --- Service ---

export class ShoppingGeneratorService {
  /**
   * Generate a shopping list from a nutrition plan and save it as an agenda project.
   *
   * @returns The created project ID
   */
  async generateAndSave(
    planId: string,
    userId: string,
    intervalDays: 3 | 7 | 14 | 28,
    preferences?: ShoppingPreferences,
  ): Promise<string> {
    // 1. Load the nutrition plan
    const plan = await prisma.nutrition_plans.findUniqueOrThrow({
      where: { id: planId },
      include: {
        weeks: {
          include: {
            days: {
              include: {
                meals: {
                  include: { foods: true },
                },
              },
            },
          },
        },
      },
    });

    // 2. Extract unique foods and aggregate quantities
    const items = this.extractShoppingItems(plan, intervalDays);

    // 3. Apply user preferences (exclusions, store grouping, etc.)
    const filteredItems = preferences
      ? this.applyPreferences(items, preferences)
      : items;

    // 4. Create the agenda project
    const projectId = createId();
    await prisma.agenda_projects.create({
      data: {
        id: projectId,
        name: `Shopping List — ${plan.name} (${intervalDays} days)`,
        description: `Auto-generated shopping list for ${intervalDays} days`,
        type: 'SHOPPING',
        status: 'ACTIVE',
        userId,
        metadata: {
          nutritionPlanId: planId,
          intervalDays,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    // 5. Create tasks for each shopping item
    await prisma.agenda_tasks.createMany({
      data: filteredItems.map((item, index) => ({
        id: createId(),
        projectId,
        title: `${item.name} — ${item.quantity} ${item.unit}`,
        status: 'TODO',
        priority: 'MEDIUM',
        order: index,
        metadata: {
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
        },
      })),
    });

    return projectId;
  }

  // --- Private Helpers ---

  private extractShoppingItems(
    plan: Record<string, unknown>,
    intervalDays: number,
  ): ShoppingItem[] {
    const foodMap = new Map<
      string,
      { quantity: number; unit: string; category: string }
    >();

    const weeks = (plan as { weeks?: Array<Record<string, unknown>> })
      .weeks ?? [];

    // Calculate how many days of meals to include
    const daysToInclude = Math.min(intervalDays, weeks.length * 7);

    let dayCount = 0;
    for (const week of weeks) {
      const days =
        (week as { days?: Array<Record<string, unknown>> }).days ?? [];
      for (const day of days) {
        if (dayCount >= daysToInclude) break;
        dayCount++;

        const meals =
          (day as { meals?: Array<Record<string, unknown>> }).meals ?? [];
        for (const meal of meals) {
          const foods =
            (meal as { foods?: Array<Record<string, unknown>> }).foods ??
            [];
          for (const food of foods) {
            const name = (food as { name?: string }).name ?? 'Unknown';
            const qty = (food as { quantity?: number }).quantity ?? 1;
            const unit = (food as { unit?: string }).unit ?? 'pz';
            const category =
              (food as { category?: string }).category ?? 'OTHER';

            const key = `${name.toLowerCase()}_${unit}`;
            const existing = foodMap.get(key);
            if (existing) {
              existing.quantity += qty;
            } else {
              foodMap.set(key, { quantity: qty, unit, category });
            }
          }
        }
      }
    }

    return Array.from(foodMap.entries()).map(([key, val]) => ({
      name: key.split('_')[0]!,
      quantity: String(Math.ceil(val.quantity)),
      unit: val.unit,
      category: val.category,
    }));
  }

  private applyPreferences(
    items: ShoppingItem[],
    preferences: ShoppingPreferences,
  ): ShoppingItem[] {
    let filtered = items;

    // Exclude items matching user exclusions
    if (preferences.excludedCategories?.length) {
      const excluded = new Set(
        preferences.excludedCategories.map((c) => c.toLowerCase()),
      );
      filtered = filtered.filter(
        (item) => !excluded.has(item.category.toLowerCase()),
      );
    }

    // Sort by preferred store grouping
    if (preferences.sortByCategory) {
      filtered.sort((a, b) => a.category.localeCompare(b.category));
    }

    return filtered;
  }
}
