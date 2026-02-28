import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceRegistry, REPO_TOKENS } from '@giulio-leone/core';
import { NutritionTemplateService } from '../services/nutrition-template.service';

// ── Helpers ──────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const TEMPLATE_ID = 'tmpl-1';
const NOW = new Date('2024-06-01T10:00:00Z');

function makeDbTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    userId: USER_ID,
    type: 'meal',
    name: 'Test Template',
    description: 'A test template',
    category: 'quick',
    tags: ['healthy', 'easy'],
    data: {
      id: 'meal-1',
      name: 'Breakfast',
      type: 'breakfast',
      foods: [
        {
          id: 'food-1',
          foodItemId: 'fi-1',
          name: 'Oats',
          quantity: 80,
          unit: 'g',
          macros: { calories: 300, protein: 10, carbs: 50, fats: 5 },
        },
      ],
      totalMacros: { calories: 300, protein: 10, carbs: 50, fats: 5 },
    },
    isPublic: false,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMealData() {
  return {
    id: 'meal-1',
    name: 'Breakfast',
    type: 'breakfast' as const,
    foods: [
      {
        id: 'food-1',
        foodItemId: 'fi-1',
        name: 'Oats',
        quantity: 80,
        unit: 'g',
        macros: { calories: 300, protein: 10, carbs: 50, fats: 5 },
      },
    ],
    totalMacros: { calories: 300, protein: 10, carbs: 50, fats: 5 },
  };
}

function makeDayData() {
  return {
    id: 'day-1',
    dayNumber: 1,
    dayName: 'Monday',
    meals: [makeMealData()],
    totalMacros: { calories: 300, protein: 10, carbs: 50, fats: 5 },
  };
}

function makeWeekData() {
  return {
    id: 'week-1',
    weekNumber: 1,
    days: [makeDayData()],
    weeklyAverageMacros: { calories: 300, protein: 10, carbs: 50, fats: 5 },
  };
}

// ── Mock repo ────────────────────────────────────────────────────────

function createMockTemplateRepo() {
  return {
    create: vi.fn(),
    findByUser: vi.fn(),
    findByIdForUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    incrementUsage: vi.fn(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('NutritionTemplateService', () => {
  let repo: ReturnType<typeof createMockTemplateRepo>;

  beforeEach(() => {
    repo = createMockTemplateRepo();
    ServiceRegistry.__setMock(REPO_TOKENS.NUTRITION_TEMPLATE, repo);
  });

  afterEach(() => {
    ServiceRegistry.__clearAll();
    vi.restoreAllMocks();
  });

  // ── createTemplate ────────────────────────────────────────────────

  describe('createTemplate', () => {
    it('creates a meal template successfully', async () => {
      repo.create.mockResolvedValue(makeDbTemplate());

      const result = await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'meal',
        name: 'Test Template',
        description: 'A test template',
        category: 'quick',
        tags: ['healthy', 'easy'],
        data: makeMealData(),
      });

      expect(result.id).toBe(TEMPLATE_ID);
      expect(result.name).toBe('Test Template');
      expect(result.type).toBe('meal');
      expect(result.tags).toEqual(['healthy', 'easy']);
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it('creates a day template', async () => {
      const dayDbTemplate = makeDbTemplate({ type: 'day', data: makeDayData() });
      repo.create.mockResolvedValue(dayDbTemplate);

      const result = await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'day',
        name: 'Day Template',
        data: makeDayData(),
      });

      expect(result.type).toBe('day');
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it('creates a week template', async () => {
      const weekDbTemplate = makeDbTemplate({ type: 'week', data: makeWeekData() });
      repo.create.mockResolvedValue(weekDbTemplate);

      const result = await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'week',
        name: 'Week Template',
        data: makeWeekData(),
      });

      expect(result.type).toBe('week');
    });

    it('trims the name', async () => {
      repo.create.mockResolvedValue(makeDbTemplate());

      await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'meal',
        name: '  Padded Name  ',
        data: makeMealData(),
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Padded Name' })
      );
    });

    it('throws when name is empty', async () => {
      await expect(
        NutritionTemplateService.createTemplate(USER_ID, {
          type: 'meal',
          name: '',
          data: makeMealData(),
        })
      ).rejects.toThrow('Il nome del template è obbligatorio');
    });

    it('throws when name is only whitespace', async () => {
      await expect(
        NutritionTemplateService.createTemplate(USER_ID, {
          type: 'meal',
          name: '   ',
          data: makeMealData(),
        })
      ).rejects.toThrow('Il nome del template è obbligatorio');
    });

    it('throws when type is invalid', async () => {
      await expect(
        NutritionTemplateService.createTemplate(USER_ID, {
          type: 'invalid' as never,
          name: 'Template',
          data: makeMealData(),
        })
      ).rejects.toThrow("Il tipo deve essere 'meal', 'day' o 'week'");
    });

    it('throws when meal template has no foods', async () => {
      await expect(
        NutritionTemplateService.createTemplate(USER_ID, {
          type: 'meal',
          name: 'Empty Meal',
          data: { ...makeMealData(), foods: [] },
        })
      ).rejects.toThrow('Il pasto deve contenere almeno un alimento');
    });

    it('throws when day template has no meals', async () => {
      await expect(
        NutritionTemplateService.createTemplate(USER_ID, {
          type: 'day',
          name: 'Empty Day',
          data: { ...makeDayData(), meals: [] },
        })
      ).rejects.toThrow('Il giorno deve contenere almeno un pasto');
    });

    it('throws when week template has no days', async () => {
      await expect(
        NutritionTemplateService.createTemplate(USER_ID, {
          type: 'week',
          name: 'Empty Week',
          data: { ...makeWeekData(), days: [] },
        })
      ).rejects.toThrow('La settimana deve contenere almeno un giorno');
    });

    it('throws when more than 10 tags are provided', async () => {
      const tooManyTags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);

      await expect(
        NutritionTemplateService.createTemplate(USER_ID, {
          type: 'meal',
          name: 'Template',
          tags: tooManyTags,
          data: makeMealData(),
        })
      ).rejects.toThrow('Massimo 10 tags consentiti');
    });

    it('defaults isPublic to false', async () => {
      repo.create.mockResolvedValue(makeDbTemplate());

      await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'meal',
        name: 'Template',
        data: makeMealData(),
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isPublic: false })
      );
    });
  });

  // ── listTemplates ─────────────────────────────────────────────────

  describe('listTemplates', () => {
    it('returns all user templates', async () => {
      repo.findByUser.mockResolvedValue([makeDbTemplate(), makeDbTemplate({ id: 'tmpl-2' })]);

      const result = await NutritionTemplateService.listTemplates(USER_ID);

      expect(result).toHaveLength(2);
      expect(repo.findByUser).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ take: 50, skip: 0 })
      );
    });

    it('passes filters through to repository', async () => {
      repo.findByUser.mockResolvedValue([]);

      await NutritionTemplateService.listTemplates(USER_ID, {
        type: 'meal',
        category: 'quick',
        tags: ['healthy'],
        limit: 10,
        offset: 5,
      });

      expect(repo.findByUser).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          type: 'meal',
          category: 'quick',
          tags: ['healthy'],
          take: 10,
          skip: 5,
        })
      );
    });

    it('ignores search strings shorter than 2 chars', async () => {
      repo.findByUser.mockResolvedValue([]);

      await NutritionTemplateService.listTemplates(USER_ID, { search: 'a' });

      expect(repo.findByUser).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ search: undefined })
      );
    });

    it('passes search string with 2+ chars', async () => {
      repo.findByUser.mockResolvedValue([]);

      await NutritionTemplateService.listTemplates(USER_ID, { search: 'oat' });

      expect(repo.findByUser).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ search: 'oat' })
      );
    });
  });

  // ── getTemplateById ───────────────────────────────────────────────

  describe('getTemplateById', () => {
    it('returns the template when found', async () => {
      repo.findByIdForUser.mockResolvedValue(makeDbTemplate());

      const result = await NutritionTemplateService.getTemplateById(TEMPLATE_ID, USER_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(TEMPLATE_ID);
      expect(result!.name).toBe('Test Template');
      expect(repo.findByIdForUser).toHaveBeenCalledWith(TEMPLATE_ID, USER_ID);
    });

    it('returns null when template not found', async () => {
      repo.findByIdForUser.mockResolvedValue(null);

      const result = await NutritionTemplateService.getTemplateById('missing', USER_ID);
      expect(result).toBeNull();
    });
  });

  // ── updateTemplate ────────────────────────────────────────────────

  describe('updateTemplate', () => {
    it('updates name and returns updated template', async () => {
      repo.findByIdForUser.mockResolvedValue(makeDbTemplate());
      repo.update.mockResolvedValue(makeDbTemplate({ name: 'Renamed' }));

      const result = await NutritionTemplateService.updateTemplate(TEMPLATE_ID, USER_ID, {
        name: 'Renamed',
      });

      expect(result.name).toBe('Renamed');
      expect(repo.update).toHaveBeenCalledWith(TEMPLATE_ID, { name: 'Renamed' });
    });

    it('updates tags', async () => {
      repo.findByIdForUser.mockResolvedValue(makeDbTemplate());
      repo.update.mockResolvedValue(makeDbTemplate({ tags: ['new-tag'] }));

      const result = await NutritionTemplateService.updateTemplate(TEMPLATE_ID, USER_ID, {
        tags: ['new-tag'],
      });

      expect(result.tags).toEqual(['new-tag']);
    });

    it('validates data against template type when data is updated', async () => {
      repo.findByIdForUser.mockResolvedValue(makeDbTemplate({ type: 'meal' }));

      await expect(
        NutritionTemplateService.updateTemplate(TEMPLATE_ID, USER_ID, {
          data: { ...makeMealData(), foods: [] },
        })
      ).rejects.toThrow('Il pasto deve contenere almeno un alimento');
    });

    it('throws when template not found or not authorized', async () => {
      repo.findByIdForUser.mockResolvedValue(null);

      await expect(
        NutritionTemplateService.updateTemplate(TEMPLATE_ID, USER_ID, { name: 'x' })
      ).rejects.toThrow('Template non trovato o non autorizzato');
    });

    it('throws when more than 10 tags on update', async () => {
      repo.findByIdForUser.mockResolvedValue(makeDbTemplate());
      const tooManyTags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);

      await expect(
        NutritionTemplateService.updateTemplate(TEMPLATE_ID, USER_ID, { tags: tooManyTags })
      ).rejects.toThrow('Massimo 10 tags consentiti');
    });
  });

  // ── deleteTemplate ────────────────────────────────────────────────

  describe('deleteTemplate', () => {
    it('deletes the template when found', async () => {
      repo.findByIdForUser.mockResolvedValue(makeDbTemplate());
      repo.delete.mockResolvedValue(undefined);

      await NutritionTemplateService.deleteTemplate(TEMPLATE_ID, USER_ID);

      expect(repo.delete).toHaveBeenCalledWith(TEMPLATE_ID);
    });

    it('throws when template not found', async () => {
      repo.findByIdForUser.mockResolvedValue(null);

      await expect(
        NutritionTemplateService.deleteTemplate(TEMPLATE_ID, USER_ID)
      ).rejects.toThrow('Template non trovato o non autorizzato');
    });
  });

  // ── incrementUsage ────────────────────────────────────────────────

  describe('incrementUsage', () => {
    it('delegates to repository', async () => {
      repo.incrementUsage.mockResolvedValue(undefined);

      await NutritionTemplateService.incrementUsage(TEMPLATE_ID);

      expect(repo.incrementUsage).toHaveBeenCalledWith(TEMPLATE_ID);
    });
  });

  // ── mapToNutritionTemplate (integration via createTemplate) ───────

  describe('mapping', () => {
    it('converts Date fields to ISO strings', async () => {
      const lastUsed = new Date('2024-05-30T08:00:00Z');
      repo.create.mockResolvedValue(makeDbTemplate({ lastUsedAt: lastUsed, usageCount: 5 }));

      const result = await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'meal',
        name: 'Template',
        data: makeMealData(),
      });

      expect(result.createdAt).toBe(NOW.toISOString());
      expect(result.lastUsedAt).toBe(lastUsed.toISOString());
      expect(result.usageCount).toBe(5);
    });

    it('handles null lastUsedAt', async () => {
      repo.create.mockResolvedValue(makeDbTemplate({ lastUsedAt: null }));

      const result = await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'meal',
        name: 'Template',
        data: makeMealData(),
      });

      expect(result.lastUsedAt).toBeUndefined();
    });

    it('handles null description and category', async () => {
      repo.create.mockResolvedValue(
        makeDbTemplate({ description: null, category: null })
      );

      const result = await NutritionTemplateService.createTemplate(USER_ID, {
        type: 'meal',
        name: 'Template',
        data: makeMealData(),
      });

      expect(result.description).toBeUndefined();
      expect(result.category).toBeUndefined();
    });
  });
});
