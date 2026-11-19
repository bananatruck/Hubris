import { CATEGORY_WEIGHTS, PRIORITY_WEIGHTS } from '@hubris/core';
import type { Importance, ScoredCategory } from '@hubris/types';

export interface CategoryMeta {
  id: ScoredCategory;
  label: string;
  color: string;
  tokenVar: string;
  weight: number;
  weightPercent: number;
  ringThickness: number;
}

// ENTERTAINMENT_EXTENSION_POINT: keep the category list in one place; do not show Entertainment until its scoring spec is finalized.
export const CATEGORY_BY_ID: Readonly<Record<ScoredCategory, CategoryMeta>> = {
  career: {
    id: 'career',
    label: 'Career',
    color: '#3b82f6',
    tokenVar: 'var(--color-career)',
    weight: CATEGORY_WEIGHTS.career,
    weightPercent: Math.round(CATEGORY_WEIGHTS.career * 100),
    ringThickness: 11,
  },
  health: {
    id: 'health',
    label: 'Health',
    color: '#22c55e',
    tokenVar: 'var(--color-health)',
    weight: CATEGORY_WEIGHTS.health,
    weightPercent: Math.round(CATEGORY_WEIGHTS.health * 100),
    ringThickness: 11,
  },
  'hobbies-habits': {
    id: 'hobbies-habits',
    label: 'Hobbies',
    color: '#f59e0b',
    tokenVar: 'var(--color-hobbies)',
    weight: CATEGORY_WEIGHTS['hobbies-habits'],
    weightPercent: Math.round(CATEGORY_WEIGHTS['hobbies-habits'] * 100),
    ringThickness: 8.5,
  },
};

const CATEGORY_ORDER = ['career', 'health', 'hobbies-habits'] as const satisfies readonly ScoredCategory[];

export const CATEGORIES: readonly CategoryMeta[] = CATEGORY_ORDER.map(
  (id) => CATEGORY_BY_ID[id],
);

export interface ImportanceMeta {
  id: Importance;
  label: string;
  weight: number;
  weightPercent: number;
  weightSummary: string;
}

function importanceMeta(id: Importance, label: string): ImportanceMeta {
  const weight = PRIORITY_WEIGHTS[id];
  const weightPercent = Math.round(weight * 100);
  return {
    id,
    label,
    weight,
    weightPercent,
    weightSummary: `${label} counts ${weightPercent}%`,
  };
}

export const IMPORTANCE_BY_ID: Readonly<Record<Importance, ImportanceMeta>> = {
  high: importanceMeta('high', 'High'),
  medium: importanceMeta('medium', 'Medium'),
  low: importanceMeta('low', 'Low'),
};

const IMPORTANCE_ORDER = ['high', 'medium', 'low'] as const satisfies readonly Importance[];

export const IMPORTANCE_OPTIONS: readonly ImportanceMeta[] = IMPORTANCE_ORDER.map(
  (id) => IMPORTANCE_BY_ID[id],
);
