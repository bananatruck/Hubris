// Days left in the week are local calendar days, today included, so suggestions change only at local midnight,
// also in weeks with a daylight saving change (23 or 25 hour days).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TrackedActivity } from '@hubris/types';
import { getWeekBounds } from '../src/weighted-score';
import { generateWeeklySuggestions } from '../src/weekly-suggestions';
import { calendarDaysLeft, isBehindPace } from '../src/suggestions';

const originalTimezone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
});

function activity(id: string, timesPerWeek: number): TrackedActivity {
    return {
        id, name: id[0].toUpperCase() + id.slice(1), category: 'health', timesPerWeek, importance: 'high', archived: false,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
}

function messages(activities: TrackedActivity[], now: Date): string[] {
    return generateWeeklySuggestions(activities, [], now).map((suggestion) => suggestion.message);
}

describe('days left across daylight saving changes', () => {
    it('keeps Monday at seven days left until midnight in the week clocks spring forward', () => {
        // Clocks move from 02:00 to 03:00 on Sunday 2026-03-08.
        const activities = [activity('meditation', 7)];
        const before = new Date(2026, 2, 2, 22, 59);
        const after = new Date(2026, 2, 2, 23, 1);
        expect(calendarDaysLeft(getWeekBounds(after).end, after)).toBe(7);
        expect(messages(activities, after)).toEqual(messages(activities, before));
        expect(messages(activities, after).some((message) => message.includes('days left'))).toBe(false);
    });

    it('counts Thursday through Sunday as four days late on Thursday in the week clocks spring forward', () => {
        const now = new Date(2026, 2, 5, 23, 30);
        expect(messages([activity('gym', 5)], now)).toContain('Gym needs 5 more this week, with 4 days left.');
    });

    it('never counts more days than the week has in the week clocks fall back', () => {
        // Clocks move from 02:00 back to 01:00 on Sunday 2026-11-01.
        const monday = new Date(2026, 9, 26, 0, 30);
        expect(calendarDaysLeft(getWeekBounds(monday).end, monday)).toBe(7);
        const earlyThursday = new Date(2026, 9, 29, 0, 30);
        const lateThursday = new Date(2026, 9, 29, 12, 0);
        expect(messages([activity('gym', 5)], earlyThursday)).toContain('Gym needs 5 more this week, with 4 days left.');
        expect(messages([activity('gym', 5)], earlyThursday)).toEqual(messages([activity('gym', 5)], lateThursday));
    });

    it('treats pace the same way for every period end', () => {
        const sunday = new Date(2026, 10, 1, 0, 30);
        const end = getWeekBounds(sunday).end;
        expect(calendarDaysLeft(end, sunday)).toBe(1);
        expect(isBehindPace(1, end, sunday)).toBe(false);
        expect(isBehindPace(2, end, sunday)).toBe(true);
        expect(calendarDaysLeft(end, new Date(2026, 10, 2, 0, 0))).toBe(0);
    });
});
