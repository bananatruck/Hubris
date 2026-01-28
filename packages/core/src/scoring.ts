// ============================================
// Hubris Core - Frequency Score Calculator
// ============================================

import {
    Activity,
    LogEntry,
    FrequencyScore,
    StatusLabel,
    FREQUENCY_TARGETS,
    STATUS_THRESHOLDS,
} from '@hubris/types';

/**
 * Get the current period boundaries for an activity based on its frequency.
 */
export function getPeriodBoundaries(
    frequencyRate: Activity['frequencyRate'],
    referenceDate: Date = new Date()
): { start: Date; end: Date } {
    const { periodDays } = FREQUENCY_TARGETS[frequencyRate];

    if (periodDays === 1) {
        // Daily: start and end of today
        const start = new Date(referenceDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(referenceDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (periodDays === 7) {
        // Weekly: Monday to Sunday
        const start = new Date(referenceDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (periodDays === 30) {
        // Monthly: 1st to last day of month
        const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    // Quarterly: 3-month periods (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
    const quarter = Math.floor(referenceDate.getMonth() / 3);
    const start = new Date(referenceDate.getFullYear(), quarter * 3, 1);
    const end = new Date(referenceDate.getFullYear(), quarter * 3 + 3, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

/**
 * Get the status label based on score.
 */
export function getStatusLabel(score: number): StatusLabel {
    if (score >= STATUS_THRESHOLDS['on-track']) {
        return 'on-track';
    }
    if (score >= STATUS_THRESHOLDS['catching-up']) {
        return 'catching-up';
    }
    return 'needs-love';
}

/**
 * Get a friendly display label for the status.
 */
export function getStatusDisplayLabel(status: StatusLabel): string {
    switch (status) {
        case 'on-track':
            return 'On Track';
        case 'catching-up':
            return 'Catching Up';
        case 'needs-love':
            return 'Needs Love';
    }
}

/**
 * Calculate the frequency score for an activity.
 */
export function calculateFrequencyScore(
    activity: Activity,
    logs: LogEntry[],
    referenceDate: Date = new Date()
): FrequencyScore {
    const { start, end } = getPeriodBoundaries(activity.frequencyRate, referenceDate);
    const { count: target } = FREQUENCY_TARGETS[activity.frequencyRate];

    // Count qualifying logs in the period
    const periodLogs = logs.filter((log) => {
        const logDate = new Date(log.timestamp);
        return (
            log.activityId === activity.id &&
            logDate >= start &&
            logDate <= end &&
            (log.completed !== false) // Binary: must be completed
        );
    });

    const completed = periodLogs.length;
    const score = Math.min((completed / target) * 100, 100);
    const remaining = Math.max(target - completed, 0);

    return {
        activityId: activity.id,
        score: Math.round(score),
        status: getStatusLabel(score),
        completed,
        target,
        remaining,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
    };
}

/**
 * Calculate the overall score across multiple activities.
 * Uses weighted average based on frequency importance.
 */
export function calculateOverallScore(
    scores: FrequencyScore[],
    activities: Activity[]
): number {
    if (scores.length === 0) return 100;

    // Weight by frequency (daily activities matter more)
    const frequencyWeights: Record<string, number> = {
        daily: 7,
        '5x-weekly': 5,
        '3x-weekly': 3,
        'twice-weekly': 2,
        weekly: 1,
        'twice-monthly': 0.5,
        monthly: 0.3,
        quarterly: 0.1,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const score of scores) {
        const activity = activities.find((a) => a.id === score.activityId);
        const weight = activity ? (frequencyWeights[activity.frequencyRate] || 1) : 1;
        totalWeight += weight;
        weightedSum += score.score * weight;
    }

    return Math.round(weightedSum / totalWeight);
}

/**
 * Generate a motivational message based on score and remaining.
 */
export function getMotivationalMessage(score: FrequencyScore): string {
    if (score.score >= 100) {
        return "You're crushing it! 🎉";
    }
    if (score.remaining === 1) {
        return `Just 1 more to reach your goal!`;
    }
    if (score.remaining > 1) {
        return `${score.remaining} more this period to stay on track.`;
    }
    return "Keep going!";
}
