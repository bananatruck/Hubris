import { describe, expect, it } from 'vitest';
import type { ActivityLog } from '@hubris/types';
import { formatDateKey, generateHeatmapData, generateLogHeatmap, getDateRange } from '../src/heatmap';

describe('local calendar dates', () => {
    it('keeps a 21:00 log on its local calendar day', () => {
        const evening = new Date(2026, 10, 17, 21);
        expect(formatDateKey(evening)).toBe('2026-11-17');
        expect(generateHeatmapData('reading', [{
            id: 'evening',
            activityId: 'reading',
            timestamp: evening.toISOString(),
            createdAt: evening.toISOString(),
            completed: true,
        }], 'binary', 1, evening)).toEqual([{
            date: '2026-11-17', intensity: 4, value: 1, logCount: 1,
        }]);
    });
});

describe('generateLogHeatmap', () => {
    it('counts all activities with every intensity threshold and fills empty days', () => {
        const logs: ActivityLog[] = [1, 2, 3, 4, 5, 6].flatMap((count, index) =>
            Array.from({ length: count }, (_, log) => ({
                id: `${index}-${log}`,
                activityId: `activity-${log}`,
                loggedAt: new Date(2026, 10, 11 + index, 21).toISOString(),
            })),
        );
        logs.push({ id: 'outside', activityId: 'a', loggedAt: new Date(2026, 10, 18).toISOString() });
        const cells = generateLogHeatmap(logs, 7, new Date(2026, 10, 17, 23));
        expect(cells.map((cell) => cell.date)).toEqual([
            '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14',
            '2026-11-15', '2026-11-16', '2026-11-17',
        ]);
        expect(cells.map((cell) => cell.value)).toEqual([1, 2, 3, 4, 5, 6, 0]);
        expect(cells.map((cell) => cell.logCount)).toEqual([1, 2, 3, 4, 5, 6, 0]);
        expect(cells.map((cell) => cell.intensity)).toEqual([1, 2, 3, 3, 4, 4, 0]);
    });

    it('handles empty input and zero days', () => {
        expect(generateLogHeatmap([], 1, new Date(2026, 0, 1))).toEqual([
            { date: '2026-01-01', value: 0, logCount: 0, intensity: 0 },
        ]);
        expect(generateLogHeatmap([], 0, new Date(2026, 0, 1))).toEqual([]);
    });

    it.each([-1, 1.5, NaN, Infinity])('rejects an invalid day count: %s', (days) => {
        const endDate = new Date(2026, 0, 1);
        expect(() => getDateRange(days, endDate)).toThrow(RangeError);
        expect(() => generateLogHeatmap([], days, endDate)).toThrow(RangeError);
    });

    it('keeps consecutive local days across the DST transition', () => {
        const logs = [0, 1, 2].map((offset) => ({
            id: String(offset), activityId: 'a',
            loggedAt: new Date(2026, 9, 31 + offset, 21).toISOString(),
        }));
        expect(generateLogHeatmap(logs, 3, new Date(2026, 10, 2)).map((cell) => [cell.date, cell.value]))
            .toEqual([['2026-10-31', 1], ['2026-11-01', 1], ['2026-11-02', 1]]);
    });
});
