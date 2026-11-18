// Acceptance tests for Kesh's scoring rules (docs/SPEC.md, "Worked examples").
// Every expected number here was derived by hand from the 40/35/25 priority
// weights and the 36/36/28 category weights before any implementation existed.

import { describe, expect, it } from 'vitest';
import type { ActivityLog, Importance, ScoredCategory, TrackedActivity } from '@hubris/types';
import {
    ACTIVITY_SCORE_CAP,
    CATEGORY_WEIGHTS,
    PRIORITY_WEIGHTS,
    activityScore,
    categoryScore,
    computeWeeklyReport,
    computeWeeklyTrend,
    overallScore,
} from '../src/weighted-score';

const PRECISION = 10;

function activity(
    id: string,
    category: ScoredCategory,
    timesPerWeek: number,
    importance: Importance,
    archived = false,
): TrackedActivity {
    return {
        id,
        name: id,
        category,
        timesPerWeek,
        importance,
        archived,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    };
}

// Week of Wednesday 2026-11-18 runs Monday 2026-11-16 00:00 to Sunday 2026-11-22 23:59:59.999 local time.
const REFERENCE = new Date(2026, 10, 18, 15, 0, 0);

let logCounter = 0;
function logsFor(activityId: string, count: number, day = new Date(2026, 10, 17, 9, 0, 0)): ActivityLog[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `log-${logCounter++}`,
        activityId,
        loggedAt: new Date(day.getTime() + i * 60_000).toISOString(),
    }));
}

describe('weights', () => {
    it('match Kesh\'s note: 40/35/25 by importance and 36/36/28 by category', () => {
        expect(PRIORITY_WEIGHTS).toEqual({ high: 0.4, medium: 0.35, low: 0.25 });
        expect(CATEGORY_WEIGHTS).toEqual({ career: 0.36, health: 0.36, 'hobbies-habits': 0.28 });
        expect(ACTIVITY_SCORE_CAP).toBe(100);
    });
});

describe('activityScore', () => {
    it('is (done / goal) * 100', () => {
        expect(activityScore(3, 5)).toBe(60);
        expect(activityScore(2, 4)).toBe(50);
        expect(activityScore(0, 3)).toBe(0);
    });

    it('caps at 100 when the goal is beaten', () => {
        expect(activityScore(7, 5)).toBe(100);
    });
});

describe('Example A: Kesh\'s own Leetcode and Classes example', () => {
    const items = [
        { importance: 'high' as const, score: 60 },
        { importance: 'medium' as const, score: 50 },
    ];

    it('renormalizes over the importances present: 41.5 / 0.75 = 166/3', () => {
        expect(categoryScore(items)).toBeCloseTo(166 / 3, PRECISION);
    });

    it('gives 41.5 under the strict fixed-weight policy', () => {
        expect(categoryScore(items, 'zero')).toBeCloseTo(41.5, PRECISION);
    });

    it('returns null for a category with no activities', () => {
        expect(categoryScore([])).toBeNull();
    });
});

describe('Example B: overall score from three categories', () => {
    it('Health with all three importances is 87.5', () => {
        expect(
            categoryScore([
                { importance: 'high', score: 100 },
                { importance: 'medium', score: 100 },
                { importance: 'low', score: 50 },
            ]),
        ).toBeCloseTo(87.5, PRECISION);
    });

    it('Hobbies with Medium and Low only is 550/9', () => {
        expect(
            categoryScore([
                { importance: 'medium', score: 100 / 3 },
                { importance: 'low', score: 100 },
            ]),
        ).toBeCloseTo(550 / 9, PRECISION);
    });

    it('overall is 0.36 * 166/3 + 0.36 * 87.5 + 0.28 * 550/9 = 30839/450', () => {
        expect(
            overallScore({ career: 166 / 3, health: 87.5, 'hobbies-habits': 550 / 9 }),
        ).toBeCloseTo(30839 / 450, PRECISION);
    });
});

describe('Example C: cap and two activities of the same importance', () => {
    it('averages the High activities and gives 260/3', () => {
        expect(
            categoryScore([
                { importance: 'high', score: activityScore(7, 5) },
                { importance: 'high', score: activityScore(1, 2) },
                { importance: 'medium', score: activityScore(4, 4) },
            ]),
        ).toBeCloseTo(260 / 3, PRECISION);
    });
});

describe('Example D: a category with no activities counts as 0', () => {
    it('overall is 0.36 * 166/3 + 0 + 0.28 * 550/9 = 8332/225', () => {
        expect(
            overallScore({ career: 166 / 3, health: null, 'hobbies-habits': 550 / 9 }),
        ).toBeCloseTo(8332 / 225, PRECISION);
    });

    it('renormalizes across non-empty categories under the alternative policy', () => {
        const expected = (0.36 * (166 / 3) + 0.28 * (550 / 9)) / (0.36 + 0.28);
        expect(
            overallScore({ career: 166 / 3, health: null, 'hobbies-habits': 550 / 9 }, 'renormalize'),
        ).toBeCloseTo(expected, PRECISION);
    });

    it('is 0 when nothing is tracked', () => {
        expect(overallScore({ career: null, health: null, 'hobbies-habits': null })).toBe(0);
    });
});

describe('computeWeeklyReport', () => {
    const activities = [
        activity('leetcode', 'career', 5, 'high'),
        activity('classes', 'career', 4, 'medium'),
        activity('gym', 'health', 3, 'high'),
        activity('sleep', 'health', 7, 'medium'),
        activity('stretching', 'health', 2, 'low'),
        activity('guitar', 'hobbies-habits', 3, 'medium'),
        activity('reading', 'hobbies-habits', 4, 'low'),
        activity('old-hobby', 'hobbies-habits', 1, 'high', true),
    ];
    const logs = [
        ...logsFor('leetcode', 3),
        ...logsFor('classes', 2),
        ...logsFor('gym', 3),
        ...logsFor('sleep', 7),
        ...logsFor('stretching', 1),
        ...logsFor('guitar', 1),
        ...logsFor('reading', 4),
        // Archived activity: its logs must not change the score.
        ...logsFor('old-hobby', 1),
        // Sunday of the previous week, one minute before this week starts: must not count.
        ...logsFor('guitar', 1, new Date(2026, 10, 15, 23, 59, 0)),
        // Monday 00:00 of the next week: must not count.
        ...logsFor('guitar', 1, new Date(2026, 10, 23, 0, 0, 0)),
    ];

    const report = computeWeeklyReport(activities, logs, REFERENCE);

    it('uses Monday to Sunday local week bounds', () => {
        expect(new Date(report.weekStart).getTime()).toBe(new Date(2026, 10, 16, 0, 0, 0, 0).getTime());
        expect(new Date(report.weekEnd).getTime()).toBe(new Date(2026, 10, 22, 23, 59, 59, 999).getTime());
    });

    it('reproduces Example B end to end', () => {
        expect(report.categories.career.score).toBeCloseTo(166 / 3, PRECISION);
        expect(report.categories.health.score).toBeCloseTo(87.5, PRECISION);
        expect(report.categories['hobbies-habits'].score).toBeCloseTo(550 / 9, PRECISION);
        expect(report.overall).toBeCloseTo(30839 / 450, PRECISION);
    });

    it('lists one row per active activity with goal, done and score', () => {
        const leetcode = report.categories.career.activities.find((row) => row.activityId === 'leetcode');
        expect(leetcode).toMatchObject({ goal: 5, done: 3, score: 60, importance: 'high' });
        const guitar = report.categories['hobbies-habits'].activities.find((row) => row.activityId === 'guitar');
        expect(guitar?.done).toBe(1);
        const ids = report.categories['hobbies-habits'].activities.map((row) => row.activityId);
        expect(ids).not.toContain('old-hobby');
    });
});

describe('computeWeeklyTrend', () => {
    it('returns 8 weeks, oldest first, ending with the current week', () => {
        const activities = [activity('leetcode', 'career', 5, 'high')];
        const logs = [
            ...logsFor('leetcode', 5, new Date(2026, 10, 10, 9, 0, 0)), // previous week: 5 of 5
            ...logsFor('leetcode', 3, new Date(2026, 10, 17, 9, 0, 0)), // this week: 3 of 5
        ];
        const trend = computeWeeklyTrend(activities, logs, REFERENCE);
        expect(trend).toHaveLength(8);
        expect(new Date(trend[7].weekStart).getTime()).toBe(new Date(2026, 10, 16).getTime());
        expect(new Date(trend[0].weekStart).getTime()).toBe(new Date(2026, 8, 28).getTime());
        // Career only: 0.36 * category score, other categories empty count as 0.
        expect(trend[7].overall).toBeCloseTo(0.36 * 60, PRECISION);
        expect(trend[6].overall).toBeCloseTo(0.36 * 100, PRECISION);
        expect(trend[5].overall).toBe(0);
        expect(trend[7].categories.career).toBeCloseTo(60, PRECISION);
        expect(trend[7].categories.health).toBeNull();
    });
});
