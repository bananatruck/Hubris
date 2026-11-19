import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TrackedActivity } from '@hubris/types';
import {
    activityScore, activityVersionAt, categoryScore, computeWeeklyReport, computeWeeklyTrend,
    getWeekBounds, overallScore,
} from '../src/index';

const originalTimezone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
});

describe('weekly scoring boundaries', () => {
    it('selects the latest activity version in effect at a moment and supports legacy activities', () => {
        const legacy: TrackedActivity = {
            id: 'a', name: 'A', category: 'career', timesPerWeek: 5,
            importance: 'high', archived: false,
            createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-18T00:00:00.000Z',
        };
        const revised: TrackedActivity = {
            ...legacy,
            timesPerWeek: 2,
            versions: [
                { from: legacy.createdAt, category: 'career', timesPerWeek: 5, importance: 'high', archived: false },
                { from: '2026-11-16T12:00:00.000Z', category: 'career', timesPerWeek: 2, importance: 'high', archived: false },
            ],
        };

        expect(activityVersionAt(revised, new Date('2026-10-31T23:59:59.999Z'))).toBeNull();
        expect(activityVersionAt(revised, new Date('2026-11-15T23:59:59.999Z'))?.timesPerWeek).toBe(5);
        expect(activityVersionAt(revised, new Date('2026-11-16T12:00:00.000Z'))?.timesPerWeek).toBe(2);
        expect(activityVersionAt(legacy, new Date('2026-11-02T00:00:00.000Z'))?.timesPerWeek).toBe(5);
    });

    it('keeps past goals and categories unchanged after this week edits', () => {
        const activity: TrackedActivity = {
            id: 'a', name: 'A', category: 'health', timesPerWeek: 1,
            importance: 'low', archived: false,
            createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-18T12:00:00.000Z',
            versions: [
                { from: '2026-11-01T00:00:00.000Z', category: 'career', timesPerWeek: 5, importance: 'high', archived: false },
                { from: '2026-11-18T12:00:00.000Z', category: 'health', timesPerWeek: 1, importance: 'low', archived: false },
            ],
        };
        const logs = [
            { id: 'past-1', activityId: 'a', loggedAt: '2026-11-10T09:00:00.000Z' },
            { id: 'past-2', activityId: 'a', loggedAt: '2026-11-11T09:00:00.000Z' },
            { id: 'current', activityId: 'a', loggedAt: '2026-11-18T13:00:00.000Z' },
        ];

        const past = computeWeeklyReport([activity], logs, new Date('2026-11-15T12:00:00.000Z'));
        expect(past.categories.career.activities[0]).toMatchObject({ goal: 5, done: 2, importance: 'high' });
        expect(past.categories.health.activities).toEqual([]);
        const current = computeWeeklyReport([activity], logs, new Date('2026-11-19T12:00:00.000Z'));
        expect(current.categories.career.activities).toEqual([]);
        expect(current.categories.health.activities[0]).toMatchObject({ goal: 1, done: 1, importance: 'low' });
    });

    it('keeps an activity in past reports after it is archived this week', () => {
        const activity: TrackedActivity = {
            id: 'a', name: 'A', category: 'career', timesPerWeek: 1,
            importance: 'high', archived: true,
            createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-18T12:00:00.000Z',
            versions: [
                { from: '2026-11-01T00:00:00.000Z', category: 'career', timesPerWeek: 1, importance: 'high', archived: false },
                { from: '2026-11-18T12:00:00.000Z', category: 'career', timesPerWeek: 1, importance: 'high', archived: true },
            ],
        };
        const logs = [{ id: 'past', activityId: 'a', loggedAt: '2026-11-10T09:00:00.000Z' }];

        expect(computeWeeklyReport([activity], logs, new Date('2026-11-15T12:00:00.000Z'))
            .categories.career.activities).toHaveLength(1);
        expect(computeWeeklyReport([activity], logs, new Date('2026-11-19T12:00:00.000Z'))
            .categories.career.activities).toEqual([]);
    });

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
        const reference = new Date(2026, 10, 22, 23, 59, 59, 999);
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

    it('keeps last week complete when another High activity is created this week', () => {
        const reference = new Date(2026, 10, 18, 15);
        const existing: TrackedActivity = {
            id: 'existing', name: 'Existing', category: 'career', timesPerWeek: 1,
            importance: 'high', archived: false,
            createdAt: new Date(2026, 0, 1).toISOString(), updatedAt: reference.toISOString(),
        };
        const activities = [existing, {
            ...existing, id: 'new', name: 'New', createdAt: reference.toISOString(),
        }];
        const logs = [{ id: 'done', activityId: 'existing', loggedAt: new Date(2026, 10, 10, 9).toISOString() }];
        const report = computeWeeklyReport(activities, logs, new Date(2026, 10, 15, 23, 59, 59, 999));
        expect(report.categories.career.score).toBe(100);
        expect(report.categories.career.activities.map((row) => row.activityId)).toEqual(['existing']);
        expect(computeWeeklyTrend(activities, logs, reference, 2).map((point) => point.categories.career))
            .toEqual([100, 0]);
    });

    it('counts logs through now inclusively and ignores future logs this week', () => {
        const reference = new Date(2026, 10, 18, 15);
        const activity: TrackedActivity = {
            id: 'a', name: 'A', category: 'career', timesPerWeek: 2,
            importance: 'high', archived: false,
            createdAt: new Date(2026, 0, 1).toISOString(), updatedAt: reference.toISOString(),
        };
        const logs = [
            { id: 'now', activityId: 'a', loggedAt: reference.toISOString() },
            { id: 'future', activityId: 'a', loggedAt: new Date(reference.getTime() + 1).toISOString() },
        ];
        expect(computeWeeklyReport([activity], logs, reference).categories.career.activities[0].done).toBe(1);
    });

    it('keeps completed past weeks in the trend and cuts only the current week at now', () => {
        const reference = new Date(2026, 10, 18, 15);
        const activity: TrackedActivity = {
            id: 'a', name: 'A', category: 'career', timesPerWeek: 1,
            importance: 'high', archived: false,
            createdAt: new Date(2026, 0, 1).toISOString(), updatedAt: reference.toISOString(),
        };
        const logs = [
            { id: 'past', activityId: 'a', loggedAt: new Date(2026, 10, 15, 23, 59, 59, 999).toISOString() },
            { id: 'future', activityId: 'a', loggedAt: new Date(2026, 10, 22, 9).toISOString() },
        ];
        expect(computeWeeklyTrend([activity], logs, reference, 2).map((point) => point.categories.career))
            .toEqual([100, 0]);
        const pastReport = computeWeeklyReport([activity], logs, new Date(2026, 10, 9), reference);
        expect(pastReport.categories.career.score).toBe(100);
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

    it('keeps consecutive local week starts across spring-forward', () => {
        const trend = computeWeeklyTrend([], [], new Date(2026, 2, 9), 2);
        expect(trend.map((point) => new Date(point.weekStart).toString())).toEqual([
            new Date(2026, 2, 2).toString(),
            new Date(2026, 2, 9).toString(),
        ]);
    });

    it('supports zero weeks and rejects invalid week counts', () => {
        expect(computeWeeklyTrend([], [], new Date(), 0)).toEqual([]);
        for (const weeks of [-1, 1.5, NaN, Infinity]) {
            expect(() => computeWeeklyTrend([], [], new Date(), weeks)).toThrow(RangeError);
        }
    });
});
