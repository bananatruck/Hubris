import { describe, expect, it } from 'vitest';
import type { TrackedActivity } from '@hubris/types';
import { generateWeeklySuggestions } from '../src/index';

const now = new Date(2026, 10, 19, 15);
const base: TrackedActivity = {
    id: 'gym', name: 'Gym', category: 'health', timesPerWeek: 5,
    importance: 'high', archived: false,
    createdAt: new Date(2026, 0, 1).toISOString(), updatedAt: now.toISOString(),
};

describe('weekly suggestion data and copy', () => {
    it('ignores future logs and excludes archived and not-yet-created activities', () => {
        const activities = [
            base, { ...base, id: 'archived', archived: true },
            { ...base, id: 'later', createdAt: new Date(2026, 10, 20).toISOString() },
        ];
        const logs = [{ id: 'future', activityId: base.id, loggedAt: new Date(now.getTime() + 1).toISOString() }];
        expect(generateWeeklySuggestions(activities, logs, now)).toEqual([{
            id: 'at-risk-gym', type: 'at-risk', activityId: 'gym', priority: 10,
            message: 'Gym needs 5 more this week, with 4 days left.',
            ctaAction: 'quick-log', ctaLabel: 'Log Gym',
        }]);
    });

    it('uses singular day copy on Sunday', () => {
        expect(generateWeeklySuggestions([base], [], new Date(2026, 10, 22, 12))[0].message)
            .toBe('Gym needs 5 more this week, with 1 day left.');
    });

    it('uses the streak type in its id and sentence case copy', () => {
        const logs = [16, 17, 18].map((day) => ({
            id: String(day), activityId: base.id, loggedAt: new Date(2026, 10, day, 9).toISOString(),
        }));
        expect(generateWeeklySuggestions([{ ...base, timesPerWeek: 7 }], logs, now)).toEqual([{
            id: 'streak-protector-gym', type: 'streak-protector', activityId: 'gym', priority: 8,
            message: 'Keep your Gym streak going: it is not logged today.',
            ctaAction: 'quick-log', ctaLabel: 'Log Gym',
        }]);
    });

    it.each([
        ['career', 'Career'], ['health', 'Health'], ['hobbies-habits', 'Hobbies'],
    ] satisfies [TrackedActivity['category'], string][])('names the %s category in light-day copy', (category, label) => {
        expect(generateWeeklySuggestions([{ ...base, category, timesPerWeek: 1 }], [], now)[0].message)
            .toBe(`Nothing logged yet today. Gym would lift your ${label} score.`);
    });
});

describe('ties', () => {
    // Storage order is random (UUID keys), so equal scores must break by importance, then name.
    const base: TrackedActivity = {
        id: '', name: '', category: 'career', timesPerWeek: 3, importance: 'low', archived: false,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const thursday = new Date(2026, 10, 19, 15);

    it('picks the light-day activity by importance, then name, whatever the storage order', () => {
        const zeta = { ...base, id: 'z', name: 'Zeta', importance: 'low' as const };
        const beta = { ...base, id: 'b', name: 'Beta', importance: 'high' as const };
        const alpha = { ...base, id: 'a', name: 'Alpha', importance: 'high' as const };
        for (const order of [[zeta, beta, alpha], [alpha, zeta, beta], [beta, alpha, zeta]]) {
            const [first] = generateWeeklySuggestions(order, [], thursday);
            expect(first?.activityId).toBe('a');
        }
    });

    it('orders tied at-risk activities by importance, then name', () => {
        const low = { ...base, id: 'low', name: 'Low', importance: 'low' as const, timesPerWeek: 9 };
        const high = { ...base, id: 'high', name: 'High', importance: 'high' as const, timesPerWeek: 9 };
        const mid = { ...base, id: 'mid', name: 'Mid', importance: 'medium' as const, timesPerWeek: 9 };
        const ids = generateWeeklySuggestions([low, mid, high], [], thursday)
            .filter((s) => s.type === 'at-risk').map((s) => s.activityId);
        expect(ids).toEqual(['high', 'mid']);
    });
});
