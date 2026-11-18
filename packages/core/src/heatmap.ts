// ============================================
// Hubris Core - Heatmap Data Transformer
// ============================================

import type { ActivityLog, LogEntry, DayHeatmapCell, TrackingTemplate } from '@hubris/types';

/**
 * Format a date as YYYY-MM-DD.
 */
export function formatDateKey(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Count all activity logs by local calendar day, oldest day first. */
export function generateLogHeatmap(
    logs: ActivityLog[],
    days: number = 365,
    endDate: Date = new Date(),
): DayHeatmapCell[] {
    const counts = new Map<string, number>();
    for (const log of logs) {
        const key = formatDateKey(new Date(log.loggedAt));
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return getDateRange(days, endDate).map((date) => {
        const key = formatDateKey(date);
        const value = counts.get(key) ?? 0;
        const intensity = value >= 5 ? 4 : value >= 3 ? 3 : value === 2 ? 2 : value === 1 ? 1 : 0;
        return { date: key, value, logCount: value, intensity };
    });
}

/**
 * Get an array of dates for the last N days.
 */
export function getDateRange(days: number, endDate: Date = new Date()): Date[] {
    if (!Number.isSafeInteger(days) || days < 0) {
        throw new RangeError('days must be a non-negative safe integer');
    }
    const dates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(endDate);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date);
    }
    return dates;
}

/**
 * Calculate intensity level (0-4) based on value and template.
 */
export function calculateIntensity(
    value: number,
    template: TrackingTemplate
): 0 | 1 | 2 | 3 | 4 {
    if (value === 0) return 0;

    switch (template) {
        case 'binary':
            return value >= 1 ? 4 : 0;

        case 'count':
            if (value >= 10) return 4;
            if (value >= 5) return 3;
            if (value >= 2) return 2;
            return 1;

        case 'duration':
            // Minutes
            if (value >= 60) return 4;
            if (value >= 30) return 3;
            if (value >= 15) return 2;
            return 1;

        case 'rating':
            // 1-10 scale
            if (value >= 8) return 4;
            if (value >= 6) return 3;
            if (value >= 4) return 2;
            return 1;

        case 'progress':
        case 'session':
            if (value >= 4) return 4;
            if (value >= 2) return 3;
            if (value >= 1) return 2;
            return 1;

        default:
            return value >= 1 ? 1 : 0;
    }
}

/**
 * Transform logs into heatmap cells for a specific activity.
 */
export function generateHeatmapData(
    activityId: string,
    logs: LogEntry[],
    template: TrackingTemplate,
    days: number = 365,
    endDate: Date = new Date()
): DayHeatmapCell[] {
    // Filter logs for this activity
    const activityLogs = logs.filter((log) => log.activityId === activityId);

    // Group logs by day
    const logsByDay = new Map<string, LogEntry[]>();
    for (const log of activityLogs) {
        const dayKey = formatDateKey(new Date(log.timestamp));
        const existing = logsByDay.get(dayKey) || [];
        existing.push(log);
        logsByDay.set(dayKey, existing);
    }

    // Generate cells for each day
    const dates = getDateRange(days, endDate);
    return dates.map((date) => {
        const dateKey = formatDateKey(date);
        const dayLogs = logsByDay.get(dateKey) || [];

        // Aggregate value based on template
        let value: number;
        if (template === 'binary') {
            value = dayLogs.some((log) => log.completed !== false) ? 1 : 0;
        } else {
            value = dayLogs.reduce((sum, log) => sum + (log.value || 0), 0);
        }

        return {
            date: dateKey,
            intensity: calculateIntensity(value, template),
            value,
            logCount: dayLogs.length,
        };
    });
}

/**
 * Get a mini heatmap (last 30 days) for quick preview.
 */
export function generateMiniHeatmap(
    activityId: string,
    logs: LogEntry[],
    template: TrackingTemplate
): DayHeatmapCell[] {
    return generateHeatmapData(activityId, logs, template, 30);
}
