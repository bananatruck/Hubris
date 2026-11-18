import type {
    ActivityLog,
    CategoryReport,
    Importance,
    ScoredCategory,
    TrackedActivity,
    WeeklyReport,
    WeeklyTrendPoint,
} from '@hubris/types';
import { getPeriodBoundaries } from './scoring';

export type EmptyGroupPolicy = 'renormalize' | 'zero';

/** Implements docs/SPEC.md scoring rules: High/Medium/Low weigh 40/35/25%. */
export const PRIORITY_WEIGHTS: Readonly<Record<Importance, number>> = Object.freeze({
    high: 0.4, medium: 0.35, low: 0.25,
});

/** Implements docs/SPEC.md scoring rules: Career/Health/Hobbies weigh 36/36/28%. */
export const CATEGORY_WEIGHTS: Readonly<Record<ScoredCategory, number>> = Object.freeze({
    career: 0.36, health: 0.36, 'hobbies-habits': 0.28,
});

/** Implements docs/SPEC.md scope: only these three categories feed the overall score. */
export const SCORED_CATEGORIES: readonly ScoredCategory[] = Object.freeze([
    'career', 'health', 'hobbies-habits',
]);
// ENTERTAINMENT_EXTENSION_POINT: add Entertainment here and to the category weights once specified.

/** Implements docs/SPEC.md decision 1: cap each activity at 100. */
export const ACTIVITY_SCORE_CAP = 100;

/** Implements docs/SPEC.md decision 3: rescale weights over present importances. */
export const EMPTY_PRIORITY_POLICY = 'renormalize' satisfies EmptyGroupPolicy;

/** Implements docs/SPEC.md decision 4: empty categories contribute zero. */
export const EMPTY_CATEGORY_POLICY = 'zero' satisfies EmptyGroupPolicy;

export function activityScore(done: number, goal: number, cap = ACTIVITY_SCORE_CAP): number {
    if (!Number.isFinite(done) || !Number.isFinite(goal) || !Number.isFinite(cap) || goal <= 0 || done < 0) {
        throw new RangeError('Activity scoring requires finite inputs, a non-negative done count and a positive goal.');
    }
    return Math.min((done / goal) * 100, cap);
}

/** Implements docs/SPEC.md decision 2: average activities sharing an importance. */
export function categoryScore(
    items: { importance: Importance; score: number }[],
    policy: EmptyGroupPolicy = EMPTY_PRIORITY_POLICY,
): number | null {
    if (items.length === 0) return null;
    const groups: Record<Importance, { total: number; count: number }> = {
        high: { total: 0, count: 0 },
        medium: { total: 0, count: 0 },
        low: { total: 0, count: 0 },
    };
    for (const item of items) {
        groups[item.importance].total += item.score;
        groups[item.importance].count++;
    }
    let weightedSum = 0;
    let presentWeight = 0;
    for (const importance of ['high', 'medium', 'low'] satisfies Importance[]) {
        const group = groups[importance];
        if (group.count === 0) continue;
        const weight = PRIORITY_WEIGHTS[importance];
        weightedSum += (group.total / group.count) * weight;
        presentWeight += weight;
    }
    return policy === 'renormalize' ? weightedSum / presentWeight : weightedSum;
}

export function overallScore(
    scores: Record<ScoredCategory, number | null>,
    policy: EmptyGroupPolicy = EMPTY_CATEGORY_POLICY,
): number {
    let weightedSum = 0;
    let presentWeight = 0;
    for (const category of SCORED_CATEGORIES) {
        const score = scores[category];
        // undefined is treated like null so a missing key cannot turn the total into NaN.
        if (score === null || score === undefined) continue;
        const weight = CATEGORY_WEIGHTS[category];
        weightedSum += score * weight;
        presentWeight += weight;
    }
    return policy === 'renormalize' && presentWeight > 0
        ? weightedSum / presentWeight
        : weightedSum;
}

/** Implements docs/SPEC.md decision 5: Monday through Sunday in local time. */
export function getWeekBounds(referenceDate: Date = new Date()): { start: Date; end: Date } {
    return getPeriodBoundaries('weekly', referenceDate);
}

const IMPORTANCE_ORDER: Readonly<Record<Importance, number>> = { high: 0, medium: 1, low: 2 };

/** Stable display order: High first, then Medium, then Low, then by name (case-insensitive). */
function compareRows(a: { importance: Importance; name: string }, b: { importance: Importance; name: string }): number {
    return IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]
        || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function computeWeeklyReport(
    activities: TrackedActivity[],
    logs: ActivityLog[],
    referenceDate: Date = new Date(),
): WeeklyReport {
    const { start, end } = getWeekBounds(referenceDate);
    const counts = new Map<string, number>();
    for (const log of logs) {
        const date = new Date(log.loggedAt);
        if (date >= start && date <= end) {
            counts.set(log.activityId, (counts.get(log.activityId) ?? 0) + 1);
        }
    }
    function reportFor(category: ScoredCategory): CategoryReport {
        const rows = activities
            .filter((activity) => !activity.archived
                && activity.category === category
                && new Date(activity.createdAt) <= end)
            .map((activity) => {
                const done = counts.get(activity.id) ?? 0;
                return {
                    activityId: activity.id,
                    name: activity.name,
                    importance: activity.importance,
                    goal: activity.timesPerWeek,
                    done,
                    score: activityScore(done, activity.timesPerWeek),
                };
            })
            .sort(compareRows);
        return { category, score: categoryScore(rows), activities: rows };
    }
    const categories = {
        career: reportFor('career'),
        health: reportFor('health'),
        'hobbies-habits': reportFor('hobbies-habits'),
    };
    return {
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        overall: overallScore({
            career: categories.career.score,
            health: categories.health.score,
            'hobbies-habits': categories['hobbies-habits'].score,
        }),
        categories,
    };
}

export function computeWeeklyTrend(
    activities: TrackedActivity[],
    logs: ActivityLog[],
    referenceDate: Date = new Date(),
    weeks = 8,
): WeeklyTrendPoint[] {
    if (!Number.isInteger(weeks) || weeks < 0) {
        throw new RangeError('Trend weeks must be a non-negative integer.');
    }
    const { start } = getWeekBounds(referenceDate);
    return Array.from({ length: weeks }, (_, index) => {
        const week = new Date(start);
        week.setDate(week.getDate() - (weeks - 1 - index) * 7);
        const report = computeWeeklyReport(activities, logs, week);
        return {
            weekStart: report.weekStart,
            weekEnd: report.weekEnd,
            overall: report.overall,
            categories: {
                career: report.categories.career.score,
                health: report.categories.health.score,
                'hobbies-habits': report.categories['hobbies-habits'].score,
            },
        };
    });
}
