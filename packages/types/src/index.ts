// ============================================
// Hubris - Shared Type Definitions
// ============================================

// --------------------------------------------
// Frequency Rates
// --------------------------------------------

export type FrequencyRate =
    | 'quarterly'
    | 'monthly'
    | 'twice-monthly'
    | 'weekly'
    | 'twice-weekly'
    | '3x-weekly'
    | '5x-weekly'
    | 'daily';

export const FREQUENCY_TARGETS: Record<FrequencyRate, { count: number; periodDays: number }> = {
    quarterly: { count: 1, periodDays: 90 },
    monthly: { count: 1, periodDays: 30 },
    'twice-monthly': { count: 2, periodDays: 30 },
    weekly: { count: 1, periodDays: 7 },
    'twice-weekly': { count: 2, periodDays: 7 },
    '3x-weekly': { count: 3, periodDays: 7 },
    '5x-weekly': { count: 5, periodDays: 7 },
    daily: { count: 1, periodDays: 1 },
};

// --------------------------------------------
// Tracking Templates
// --------------------------------------------

export type TrackingTemplate =
    | 'binary'      // Did it / Didn't
    | 'count'       // Number (e.g., problems solved)
    | 'duration'    // Minutes
    | 'rating'      // 1-10 score
    | 'progress'    // Episodes / Chapters / Pages
    | 'session';    // Duration + optional metadata

// --------------------------------------------
// Visibility States
// --------------------------------------------

export type VisibilityState =
    | 'active'    // Normal state
    | 'pinned'    // Shows in Quick Log + top lists
    | 'hidden'    // Tracked but not shown
    | 'archived'; // History kept, removed from views

// --------------------------------------------
// Categories
// --------------------------------------------

export type Category =
    | 'career'
    | 'entertainment'
    | 'hobbies-habits';

export const CATEGORY_LABELS: Record<Category, string> = {
    career: 'Career',
    entertainment: 'Entertainment',
    'hobbies-habits': 'Hobbies & Habits',
};

// --------------------------------------------
// Status Labels (Positive Framing)
// --------------------------------------------

export type StatusLabel =
    | 'on-track'      // >= 80
    | 'catching-up'   // 50-79
    | 'needs-love';   // < 50

export const STATUS_THRESHOLDS = {
    'on-track': 80,
    'catching-up': 50,
} as const;

// --------------------------------------------
// Plan Status
// --------------------------------------------

export type PlanStatus =
    | 'planned'
    | 'completed'
    | 'skipped'
    | 'snoozed';

// --------------------------------------------
// Core Entities
// --------------------------------------------

export interface Activity {
    id: string;
    name: string;
    category: Category;
    frequencyRate: FrequencyRate;
    template: TrackingTemplate;
    visibility: VisibilityState;
    color: string;
    icon?: string;
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
}

export interface LogEntry {
    id: string;
    activityId: string;
    timestamp: string; // ISO date

    // Template-specific values
    value?: number;       // count, duration, rating, progress
    completed?: boolean;  // binary
    note?: string;

    // Metadata
    createdAt: string;
}

export interface Plan {
    id: string;
    activityId: string;
    scheduledAt: string;  // ISO date
    duration?: number;    // minutes
    status: PlanStatus;
    reminderEnabled: boolean;

    // Completion tracking
    completedAt?: string;
    logEntryId?: string;  // Links to created log

    createdAt: string;
    updatedAt: string;
}

export interface Goal {
    id: string;
    title: string;
    description?: string;
    activityId?: string;  // Optional link to activity
    category?: Category;
    targetDate?: string;  // ISO date
    targetValue?: number;
    completed: boolean;
    completedAt?: string;

    createdAt: string;
    updatedAt: string;
}

// --------------------------------------------
// Scoring & Analytics Types
// --------------------------------------------

export interface FrequencyScore {
    activityId: string;
    score: number;        // 0-100
    status: StatusLabel;
    completed: number;
    target: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
}

export interface DayHeatmapCell {
    date: string;        // YYYY-MM-DD
    intensity: 0 | 1 | 2 | 3 | 4;  // GitHub-style 5 levels
    value: number;       // Raw value
    logCount: number;
}

export interface Suggestion {
    id: string;
    type: 'at-risk' | 'streak-protector' | 'light-day' | 'weekly-review';
    activityId?: string;
    message: string;
    ctaLabel: string;
    ctaAction: 'plan' | 'quick-log' | 'dismiss';
    priority: number;
}

// --------------------------------------------
// UI State Types
// --------------------------------------------

export interface TodayStats {
    overallScore: number;
    completedToday: number;
    plannedRemaining: number;
    atRiskCount: number;
}
