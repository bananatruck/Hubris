import { describe, expect, it } from 'vitest';
import type { TrackedActivity } from '@hubris/types';
import {
    activityScore, categoryScore, computeWeeklyReport, computeWeeklyTrend,
    getWeekBounds, overallScore,
} from '../src/index';

describe('weekly scoring boundaries', () => {
    it.each([
        [1, 0, 100], [1, -1, 100], [NaN, 1, 100], [Infinity, 1, 100],
        [1, NaN, 100], [1, Infinity, 100], [1, 1, NaN], [1, 1, Infinity],
    ])('rejects invalid score inputs (%s, %s, %s)', (done, goal, cap) => {
        expect(() => activityScore(done, goal, cap)).toThrow(RangeError);
    });

    it('orders rows by importance (High first), then by name, whatever the storage order', () => {
        const base: TrackedActivity = {
            id: '', name: '', category: 'career', timesPerWeek: 1, importance: 'low', archived: false,
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        };
        const activities = [
            { ...base, id: 'z1', name: 'Writing', importance: 'low' as const },
            { ...base, id: 'a1', name: 'classes', importance: 'medium' as const },
            { ...base, id: 'm1', name: 'Leetcode', importance: 'high' as const },
            { ...base, id: 'b1', name: 'Algebra', importance: 'medium' as const },
        ];
        const rows = computeWeeklyReport(activities, [], new Date(2026, 10, 18)).categories.career.activities;
        expect(rows.map((row) => row.name)).toEqual(['Leetcode', 'Algebra', 'classes', 'Writing']);
    });

    it('rejects a negative done count', () => {
        expect(() => activityScore(-1, 5)).toThrow(RangeError);
    });

    it('treats a missing category like an empty one instead of returning NaN', () => {
        const partial = { career: 50, health: 50 } as unknown as Parameters<typeof overallScore>[0];
        expect(overallScore(partial)).toBeCloseTo(0.36 * 50 + 0.36 * 50, 12);
    });

    it('supports a custom cap and preserves fractional scores', () => {
        expect(activityScore(7, 5, 150)).toBe(140);
        expect(activityScore(1, 3)).toBeCloseTo(100 / 3, 12);
    });

    it('keeps empty scores explicit under both policies', () => {
        expect(categoryScore([], 'zero')).toBeNull();
        expect(overallScore({ career: null, health: null, 'hobbies-habits': null }, 'renormalize')).toBe(0);
    });

    it('counts exact week endpoints and excludes unknown and archived activity logs', () => {
        const reference = new Date(2026, 10, 22, 23);
        const { start, end } = getWeekBounds(reference);
        const active: TrackedActivity = {
            id: 'a', name: 'A', category: 'career', timesPerWeek: 4,
            importance: 'low', archived: false,
            createdAt: start.toISOString(), updatedAt: start.toISOString(),
        };
        const activities = [active, { ...active, id: 'archived', archived: true }];
        const logs = [
            { id: 'start', activityId: 'a', loggedAt: start.toISOString() },
            { id: 'end', activityId: 'a', loggedAt: end.toISOString() },
            { id: 'before', activityId: 'a', loggedAt: new Date(start.getTime() - 1).toISOString() },
            { id: 'after', activityId: 'a', loggedAt: new Date(end.getTime() + 1).toISOString() },
            { id: 'unknown', activityId: 'missing', loggedAt: start.toISOString() },
            { id: 'old', activityId: 'archived', loggedAt: start.toISOString() },
        ];
        const report = computeWeeklyReport(activities, logs, reference);
        expect(report.categories.career.activities).toEqual([
            { activityId: 'a', name: 'A', importance: 'low', goal: 4, done: 2, score: 50 },
        ]);
        expect(report.overall).toBe(18);
    });

    it('steps back from a Sunday across DST without skipping or duplicating weeks', () => {
        const reference = new Date(2026, 10, 8, 23, 30);
        const original = reference.getTime();
        const trend = computeWeeklyTrend([], [], reference, 3);
        expect(trend.map((point) => new Date(point.weekStart).toString())).toEqual([
            new Date(2026, 9, 19).toString(),
            new Date(2026, 9, 26).toString(),
            new Date(2026, 10, 2).toString(),
        ]);
        expect(trend.map((point) => new Date(point.weekEnd).getTime())).toEqual([
            new Date(2026, 9, 25, 23, 59, 59, 999).getTime(),
            new Date(2026, 10, 1, 23, 59, 59, 999).getTime(),
            new Date(2026, 10, 8, 23, 59, 59, 999).getTime(),
        ]);
        expect(reference.getTime()).toBe(original);
    });

    it('supports zero weeks and rejects invalid week counts', () => {
        expect(computeWeeklyTrend([], [], new Date(), 0)).toEqual([]);
        for (const weeks of [-1, 1.5, NaN, Infinity]) {
            expect(() => computeWeeklyTrend([], [], new Date(), weeks)).toThrow(RangeError);
        }
    });
});
