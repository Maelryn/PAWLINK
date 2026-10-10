import { ar } from './ar';
import { en } from './en';
import { fr } from './fr';
import type { AiTemplates, Lang } from './types';

/**
 * Language lookup for the AI text.
 *
 * An unknown language falls back to French rather than throwing: the caller is a
 * browser that may send anything, and an AI answer in the wrong language is far
 * better than no answer at all.
 */
const TEMPLATES: Record<Lang, AiTemplates> = { fr, en, ar };

export const DEFAULT_LANG: Lang = 'fr';

export function isLang(value: unknown): value is Lang {
  return value === 'fr' || value === 'en' || value === 'ar';
}

export function templatesFor(lang: Lang | undefined): AiTemplates {
  return TEMPLATES[lang ?? DEFAULT_LANG] ?? fr;
}

export type { AiTemplates, Lang } from './types';
