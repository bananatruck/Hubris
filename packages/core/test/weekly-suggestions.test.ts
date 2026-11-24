// Acceptance tests for weekly suggestions (round 2), written by the lead before the implementation.
// They carry the rules of the existing engine in src/suggestions.ts over to the weekly model:
// at-risk = still short of the goal and more sessions remain than days left in the week
// (local calendar days through Sunday, today included, as in isAtRisk), worst score first, at most two,
// priority 10 - floor(score / 10); streak protector for daily goals (7 a week) not yet logged today,
// priority 8; light day when nothing at all was logged today, for the lowest-scoring activity under 50
// that is not already suggested, priority 5; at most three suggestions, highest priority first.

import { describe, expect, it } from 'vitest';
import type { ActivityLog, Importance, ScoredCategory, TrackedActivity } from '@hubris/types';
import { generateWeeklySuggestions } from '../src/weekly-suggestions';
import { isAtRisk } from '../src/suggestions';

// Thursday 2026-11-19 15:00 local. The week ends Sunday 2026-11-22,
// so Thursday through Sunday leaves 4 days.
const THURSDAY = new Date(2026, 10, 19, 15, 0, 0);

function activity(
    id: string,
    timesPerWeek: number,
    importance: Importance = 'medium',
    category: ScoredCategory = 'career',
    archived = false,
): TrackedActivity {
    return {
        id, name: id[0].toUpperCase() + id.slice(1), category, timesPerWeek, importance, archived,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
}

let counter = 0;
function logOn(activityId: string, day: number, hour = 9): ActivityLog {
    return { id: `log-${counter++}`, activityId, loggedAt: new Date(2026, 10, day, hour).toISOString() };
}

describe('generateWeeklySuggestions', () => {
    it('ranks at-risk first, then the streak protector, and keeps three', () => {
        const activities = [
            activity('leetcode', 5, 'high'), // 0 of 5: 5 left > 4 days, score 0, priority 10
            activity('writing', 6, 'low'), // 1 of 6: 5 left > 4 days, score 16.7, priority 9
            activity('guitar', 3), // 1 of 3: 2 left, on pace
            activity('gym', 3, 'high', 'health'), // 0 of 3: 3 left, on pace, but needs love
            activity('meditation', 7, 'high', 'health'), // 3 of 7, none today: 4 left = 4 days, streak
        ];
        const logs = [
            logOn('writing', 16), logOn('guitar', 17),
            logOn('meditation', 16), logOn('meditation', 17), logOn('meditation', 18),
        ];
        const suggestions = generateWeeklySuggestions(activities, logs, THURSDAY);
        expect(suggestions.map((s) => [s.type, s.activityId, s.priority])).toEqual([
            ['at-risk', 'leetcode', 10],
            ['at-risk', 'writing', 9],
            ['streak-protector', 'meditation', 8],
        ]);
        for (const suggestion of suggestions) {
            const name = activities.find((a) => a.id === suggestion.activityId)?.name ?? '';
            expect(suggestion.message).toContain(name);
            expect(suggestion.ctaAction).toBe('quick-log');
            expect(suggestion.message).not.toMatch(/—/);
        }
    });

    it('suggests a light day for the lowest-scoring activity when nothing was logged today', () => {
        const activities = [activity('guitar', 3), activity('gym', 3, 'high', 'health'), activity('reading', 2, 'low')];
        const logs = [logOn('guitar', 17), logOn('reading', 16), logOn('reading', 18)];
        const suggestions = generateWeeklySuggestions(activities, logs, THURSDAY);
        expect(suggestions.map((s) => [s.type, s.activityId, s.priority])).toEqual([['light-day', 'gym', 5]]);
    });

    it('skips the light day once anything was logged today', () => {
        const activities = [activity('guitar', 3), activity('gym', 3, 'high', 'health')];
        const logs = [logOn('guitar', 19, 8)];
        expect(generateWeeklySuggestions(activities, logs, THURSDAY)).toEqual([]);
    });

    it('caps at-risk suggestions at the two worst scores', () => {
        const activities = [activity('a', 9), activity('b', 8), activity('c', 7, 'high')];
        const logs = [logOn('a', 16), logOn('a', 17), logOn('b', 16), logOn('c', 19, 8)];
        // a: 2 of 9 (22.2), b: 1 of 8 (12.5), c: 1 of 7 (14.3), all with more than 4 left.
        const suggestions = generateWeeklySuggestions(activities, logs, THURSDAY);
        // b and c are the two worst; both have priority 9, so High (c) comes before Medium (b).
        expect(suggestions.filter((s) => s.type === 'at-risk').map((s) => s.activityId)).toEqual(['c', 'b']);
    });

    it('ignores archived activities, met goals and logs outside this week', () => {
        const activities = [activity('old', 5, 'high', 'career', true), activity('done', 2)];
        const logs = [logOn('done', 16), logOn('done', 17), logOn('done', 19, 8), logOn('old', 12)];
        expect(generateWeeklySuggestions(activities, logs, THURSDAY)).toEqual([]);
    });

    it('returns nothing when there are no activities', () => {
        expect(generateWeeklySuggestions([], [], THURSDAY)).toEqual([]);
    });
});

describe('legacy isAtRisk keeps its behaviour', () => {
    it('still flags a weekly activity with more sessions left than days', () => {
        const legacy = {
            id: 'x', name: 'X', category: 'career' as const, frequencyRate: '5x-weekly' as const,
            template: 'count' as const, visibility: 'active' as const, color: '#000',
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        };
        const score = {
            activityId: 'x', score: 0, status: 'needs-love' as const, completed: 0, target: 5, remaining: 5,
            periodStart: '', periodEnd: '',
        };
        expect(isAtRisk(legacy, score, THURSDAY)).toBe(true);
        expect(isAtRisk(legacy, { ...score, remaining: 4, score: 20 }, THURSDAY)).toBe(false);
    });
});
