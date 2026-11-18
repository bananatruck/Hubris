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
export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: 'career',
    label: 'Career',
    color: '#3b82f6',
    tokenVar: 'var(--color-career)',
    weight: CATEGORY_WEIGHTS.career,
    weightPercent: Math.round(CATEGORY_WEIGHTS.career * 100),
    ringThickness: 11,
  },
  {
    id: 'health',
    label: 'Health',
    color: '#22c55e',
    tokenVar: 'var(--color-health)',
    weight: CATEGORY_WEIGHTS.health,
    weightPercent: Math.round(CATEGORY_WEIGHTS.health * 100),
    ringThickness: 11,
  },
  {
    id: 'hobbies-habits',
    label: 'Hobbies',
    color: '#f59e0b',
    tokenVar: 'var(--color-hobbies)',
    weight: CATEGORY_WEIGHTS['hobbies-habits'],
    weightPercent: Math.round(CATEGORY_WEIGHTS['hobbies-habits'] * 100),
    ringThickness: 8.5,
  },
] as const;

export const CATEGORY_BY_ID: Readonly<Record<ScoredCategory, CategoryMeta>> = {
  career: CATEGORIES[0],
  health: CATEGORIES[1],
  'hobbies-habits': CATEGORIES[2],
};

export interface ImportanceMeta {
  id: Importance;
  label: string;
  weight: number;
  weightPercent: number;
  weightSummary: string;
}

export const IMPORTANCE_OPTIONS: readonly ImportanceMeta[] = [
  {
    id: 'high',
    label: 'High',
    weight: PRIORITY_WEIGHTS.high,
    weightPercent: Math.round(PRIORITY_WEIGHTS.high * 100),
    weightSummary: 'High counts 40%',
  },
  {
    id: 'medium',
    label: 'Medium',
    weight: PRIORITY_WEIGHTS.medium,
    weightPercent: Math.round(PRIORITY_WEIGHTS.medium * 100),
    weightSummary: 'Medium counts 35%',
  },
  {
    id: 'low',
    label: 'Low',
    weight: PRIORITY_WEIGHTS.low,
    weightPercent: Math.round(PRIORITY_WEIGHTS.low * 100),
    weightSummary: 'Low counts 25%',
  },
] as const;

export const IMPORTANCE_BY_ID: Readonly<Record<Importance, ImportanceMeta>> = {
  high: IMPORTANCE_OPTIONS[0],
  medium: IMPORTANCE_OPTIONS[1],
  low: IMPORTANCE_OPTIONS[2],
};
