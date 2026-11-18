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
    | 'health'
    | 'entertainment'
    | 'hobbies-habits';

export const CATEGORY_LABELS: Record<Category, string> = {
    career: 'Career',
    health: 'Health',
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

// --------------------------------------------
// Weekly Weighted Scoring (Kesh's score-per-category spec, docs/SPEC.md)
// --------------------------------------------

/** How much an activity matters inside its category (40 / 35 / 25 percent). */
export type Importance = 'high' | 'medium' | 'low';

/**
 * Categories that feed the overall score (36 / 36 / 28 percent).
 *
 * ENTERTAINMENT_EXTENSION_POINT: Entertainment is deliberately not listed here.
 * Kesh's note describes it as a separate catalog with its own score and stops
 * at "Movies:", so its rules are still his to decide.
 */
export type ScoredCategory = 'career' | 'health' | 'hobbies-habits';

export interface TrackedActivity {
    id: string;
    name: string;
    category: ScoredCategory;
    /** Weekly frequency goal, an integer from 1 to 99 ("5 times a week"). */
    timesPerWeek: number;
    importance: Importance;
    /** Archived activities keep their logs but leave the score. */
    archived: boolean;
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
}

/** One log entry means the activity was done once. */
export interface ActivityLog {
    id: string;
    activityId: string;
    loggedAt: string; // ISO date
    note?: string;
}

export interface ActivityScoreRow {
    activityId: string;
    name: string;
    importance: Importance;
    goal: number;
    done: number;
    /** 0 to 100, already capped. */
    score: number;
}

export interface CategoryReport {
    category: ScoredCategory;
    /** null when the category has no active activities. */
    score: number | null;
    activities: ActivityScoreRow[];
}

export interface WeeklyReport {
    weekStart: string; // ISO date, Monday 00:00 local
    weekEnd: string; // ISO date, Sunday 23:59:59.999 local
    /** 0 to 100, full precision; round only for display. */
    overall: number;
    categories: Record<ScoredCategory, CategoryReport>;
}

export interface WeeklyTrendPoint {
    weekStart: string;
    weekEnd: string;
    overall: number;
    categories: Record<ScoredCategory, number | null>;
}

export interface HubrisExport {
    app: 'hubris';
    schemaVersion: 1;
    exportedAt: string; // ISO date
    activities: TrackedActivity[];
    logs: ActivityLog[];
}
