// ============================================
// Hubris Core - Smart Suggestions Generator
// ============================================

import {
    Activity,
    LogEntry,
    Plan,
    FrequencyScore,
    Suggestion,
    FREQUENCY_TARGETS,
} from '@hubris/types';
import { calculateFrequencyScore, getPeriodBoundaries } from './scoring';

/**
 * Check if an activity is at risk of missing its target.
 */
export function isAtRisk(
    activity: Activity,
    score: FrequencyScore,
    referenceDate: Date = new Date()
): boolean {
    if (score.score >= 100) return false;

    const { end } = getPeriodBoundaries(activity.frequencyRate, referenceDate);
    const { periodDays } = FREQUENCY_TARGETS[activity.frequencyRate];

    // Calculate remaining time in period
    const msRemaining = end.getTime() - referenceDate.getTime();
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

    // Activity is at risk if remaining sessions > remaining days
    // (for weekly+) or if less than 25% time left with < 50% completion
    if (periodDays >= 7) {
        return score.remaining > Math.ceil(daysRemaining);
    }

    // For daily, at risk if not done today
    return score.remaining > 0;
}

/**
 * Generate smart suggestions based on activity scores and plans.
 */
export function generateSuggestions(
    activities: Activity[],
    logs: LogEntry[],
    plans: Plan[],
    referenceDate: Date = new Date()
): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Filter to only active/pinned activities
    const visibleActivities = activities.filter(
        (a) => a.visibility === 'active' || a.visibility === 'pinned'
    );

    // Calculate scores for all activities
    const scores = visibleActivities.map((activity) => ({
        activity,
        score: calculateFrequencyScore(activity, logs, referenceDate),
    }));

    // 1. At-risk suggestions (highest priority)
    const atRiskActivities = scores
        .filter(({ activity, score }) => isAtRisk(activity, score, referenceDate))
        .sort((a, b) => a.score.score - b.score.score) // Worst scores first
        .slice(0, 2);

    for (const { activity, score } of atRiskActivities) {
        suggestions.push({
            id: `at-risk-${activity.id}`,
            type: 'at-risk',
            activityId: activity.id,
            message: `${activity.name} is ${score.remaining > 1 ? `${score.remaining} sessions` : '1 session'} behind this week.`,
            ctaLabel: 'Plan a quick session',
            ctaAction: 'plan',
            priority: 10 - Math.floor(score.score / 10),
        });
    }

    // 2. Streak protector (for daily activities)
    const dailyActivities = scores.filter(
        ({ activity, score }) =>
            activity.frequencyRate === 'daily' &&
            score.remaining > 0 &&
            !atRiskActivities.some((ar) => ar.activity.id === activity.id)
    );

    if (dailyActivities.length > 0) {
        const { activity } = dailyActivities[0];
        suggestions.push({
            id: `streak-${activity.id}`,
            type: 'streak-protector',
            activityId: activity.id,
            message: `Keep your ${activity.name} streak alive with a quick 2-minute version.`,
            ctaLabel: 'Quick log',
            ctaAction: 'quick-log',
            priority: 8,
        });
    }

    // 3. Light day suggestion (if today is light on plans)
    const todayPlans = plans.filter((p) => {
        const planDate = new Date(p.scheduledAt);
        const today = new Date(referenceDate);
        return (
            planDate.toDateString() === today.toDateString() &&
            p.status === 'planned'
        );
    });

    if (todayPlans.length < 2 && scores.length > 0) {
        const needsLoveActivities = scores
            .filter(({ score }) => score.status === 'needs-love')
            .slice(0, 1);

        if (needsLoveActivities.length > 0) {
            const { activity } = needsLoveActivities[0];
            suggestions.push({
                id: `light-day-${activity.id}`,
                type: 'light-day',
                activityId: activity.id,
                message: `Today looks light! Add a small ${activity.name} session?`,
                ctaLabel: 'Plan it',
                ctaAction: 'plan',
                priority: 5,
            });
        }
    }

    // Sort by priority (highest first) and limit to 3
    return suggestions
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);
}

/**
 * Get a single motivational suggestion text for the home screen.
 */
export function getHomeMotivation(
    overallScore: number,
    completedToday: number
): string {
    if (overallScore >= 90) {
        return "You're crushing it this week! 🔥";
    }
    if (overallScore >= 70) {
        return `Nice progress! ${completedToday} wins today.`;
    }
    if (overallScore >= 50) {
        return "You're catching up. Keep going! 💪";
    }
    if (completedToday > 0) {
        return `${completedToday} small win${completedToday > 1 ? 's' : ''} today. Every bit counts!`;
    }
    return "Start with one small win today.";
}
