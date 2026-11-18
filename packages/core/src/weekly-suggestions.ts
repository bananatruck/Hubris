import type { ActivityLog, ScoredCategory, Suggestion, TrackedActivity } from '@hubris/types';
import { formatDateKey } from './heatmap';
import { isBehindPace } from './suggestions';
import { computeWeeklyReport, SCORED_CATEGORIES } from './weighted-score';

const CATEGORY_NAMES: Readonly<Record<ScoredCategory, string>> = {
    career: 'Career', health: 'Health', 'hobbies-habits': 'Hobbies',
};

/** Apply the existing suggestion priorities to weekly goals and local calendar days. */
export function generateWeeklySuggestions(
    activities: TrackedActivity[],
    logs: ActivityLog[],
    now: Date = new Date(),
): Suggestion[] {
    const report = computeWeeklyReport(activities, logs, now);
    const rows = new Map(SCORED_CATEGORIES.flatMap((category) =>
        report.categories[category].activities.map((row) => [row.activityId, row] as const)));
    const scores = activities
        .filter((activity) => rows.has(activity.id) && new Date(activity.createdAt) <= now)
        .flatMap((activity) => {
            const row = rows.get(activity.id);
            return row ? [{ activity, ...row, remaining: Math.max(row.goal - row.done, 0) }] : [];
        })
        .sort((a, b) => a.score - b.score);
    const today = formatDateKey(now);
    const loggedToday = new Set(logs.filter((log) => {
        const date = new Date(log.loggedAt);
        return date <= now && formatDateKey(date) === today;
    }).map((log) => log.activityId));
    const end = new Date(report.weekEnd);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const suggestions: Suggestion[] = [];
    function add(type: Suggestion['type'], activity: TrackedActivity, message: string, priority: number): void {
        suggestions.push({
            id: `${type}-${activity.id}`, type, activityId: activity.id, message,
            ctaAction: 'quick-log', ctaLabel: `Log ${activity.name}`, priority,
        });
    }
    for (const { activity, remaining, score } of scores
        .filter((item) => item.remaining > 0 && isBehindPace(item.remaining, end, now))
        .slice(0, 2)) {
        add('at-risk', activity,
            `${activity.name} needs ${remaining} more this week, with ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`,
            10 - Math.floor(score / 10));
    }
    const alreadySuggested = (id: string): boolean => suggestions.some((suggestion) => suggestion.activityId === id);
    const streak = scores.find(({ activity, remaining }) => activity.timesPerWeek === 7
        && remaining > 0 && !loggedToday.has(activity.id) && !alreadySuggested(activity.id));
    if (streak) {
        add('streak-protector', streak.activity,
            `Keep your ${streak.activity.name} streak going: it is not logged today.`, 8);
    }
    if (loggedToday.size === 0) {
        const light = scores.find(({ activity, score }) => score < 50 && !alreadySuggested(activity.id));
        if (light) {
            add('light-day', light.activity,
                `Nothing logged yet today. ${light.activity.name} would lift your ${CATEGORY_NAMES[light.activity.category]} score.`, 5);
        }
    }
    return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
