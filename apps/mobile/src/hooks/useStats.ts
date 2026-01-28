// ============================================
// Hubris - Stats Hook
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ActivityRecord } from '../db/database';
import { Category } from './useActivities';

export interface WeeklyStats {
    score: number;
    completed: number;
    remaining: number;
    atRisk: number;
    statusLabel: string;
}

export interface ActivityStats {
    activity: ActivityRecord;
    weeklyCount: number;
    targetCount: number;
    score: number;
    status: string;
}

export interface Suggestion {
    id: string;
    message: string;
    cta: string;
    type: 'at-risk' | 'light-day' | 'streak' | 'milestone';
    activityId?: string;
}

// Simple score-to-status conversion
function getStatusFromScore(score: number): string {
    if (score >= 80) return 'On Track';
    if (score >= 50) return 'Catching Up';
    return 'Needs Love';
}

export function useWeeklyStats() {
    const [stats, setStats] = useState<WeeklyStats>({
        score: 0,
        completed: 0,
        remaining: 0,
        atRisk: 0,
        statusLabel: 'Loading...',
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const db = await getDatabase();

            // Get start of current week (Sunday)
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);

            // Get all active activities
            const activities = await db.getAllAsync<ActivityRecord>(
                `SELECT * FROM activities WHERE visibility != 'archived'`
            );

            // Get log counts for this week per activity
            const logCounts = await db.getAllAsync<{ activity_id: string; count: number }>(
                `SELECT activity_id, COUNT(*) as count
                 FROM log_entries
                 WHERE logged_at >= ?
                 GROUP BY activity_id`,
                [startOfWeek.toISOString()]
            );

            const countMap = new Map<string, number>();
            logCounts.forEach((row) => {
                countMap.set(row.activity_id, row.count);
            });

            // Priority weights: High=40%, Medium=35%, Low=25%
            const PRIORITY_WEIGHTS = { high: 0.40, medium: 0.35, low: 0.25 };

            // Calculate category scores with priority weighting
            const categoryScores: Record<Category, {
                highTotal: number; highCount: number;
                mediumTotal: number; mediumCount: number;
                lowTotal: number; lowCount: number;
            }> = {
                career: { highTotal: 0, highCount: 0, mediumTotal: 0, mediumCount: 0, lowTotal: 0, lowCount: 0 },
                health: { highTotal: 0, highCount: 0, mediumTotal: 0, mediumCount: 0, lowTotal: 0, lowCount: 0 },
                'hobbies-habits': { highTotal: 0, highCount: 0, mediumTotal: 0, mediumCount: 0, lowTotal: 0, lowCount: 0 },
                entertainment: { highTotal: 0, highCount: 0, mediumTotal: 0, mediumCount: 0, lowTotal: 0, lowCount: 0 },
            };

            let completed = 0;
            let remaining = 0;
            let atRisk = 0;

            activities.forEach((activity) => {
                const count = countMap.get(activity.id) || 0;
                const target = activity.frequency_target;
                const priority = activity.priority || 'medium';

                // Calculate score for this activity (0-100)
                const activityScore = Math.min((count / target) * 100, 100);

                const catScores = categoryScores[activity.category as Category];
                if (catScores) {
                    if (priority === 'high') {
                        catScores.highTotal += activityScore;
                        catScores.highCount++;
                    } else if (priority === 'medium') {
                        catScores.mediumTotal += activityScore;
                        catScores.mediumCount++;
                    } else {
                        catScores.lowTotal += activityScore;
                        catScores.lowCount++;
                    }
                }

                if (count >= target) {
                    completed++;
                } else {
                    remaining++;
                    // Activity is at risk if we're past mid-week and behind
                    const dayOfWeek = now.getDay();
                    const expectedByNow = Math.ceil((target * (dayOfWeek + 1)) / 7);
                    if (count < expectedByNow) {
                        atRisk++;
                    }
                }
            });

            // Calculate weighted average for a category using priority weights
            const getCategoryWeightedScore = (cat: Category): number => {
                const scores = categoryScores[cat];
                const hasHigh = scores.highCount > 0;
                const hasMedium = scores.mediumCount > 0;
                const hasLow = scores.lowCount > 0;

                // If no activities in this category, return 0
                if (!hasHigh && !hasMedium && !hasLow) return 0;

                // Calculate average for each priority level
                const highAvg = hasHigh ? scores.highTotal / scores.highCount : 0;
                const mediumAvg = hasMedium ? scores.mediumTotal / scores.mediumCount : 0;
                const lowAvg = hasLow ? scores.lowTotal / scores.lowCount : 0;

                // Calculate weighted sum, normalizing weights for present priorities
                let totalWeight = 0;
                let weightedSum = 0;

                if (hasHigh) {
                    weightedSum += highAvg * PRIORITY_WEIGHTS.high;
                    totalWeight += PRIORITY_WEIGHTS.high;
                }
                if (hasMedium) {
                    weightedSum += mediumAvg * PRIORITY_WEIGHTS.medium;
                    totalWeight += PRIORITY_WEIGHTS.medium;
                }
                if (hasLow) {
                    weightedSum += lowAvg * PRIORITY_WEIGHTS.low;
                    totalWeight += PRIORITY_WEIGHTS.low;
                }

                return totalWeight > 0 ? weightedSum / totalWeight : 0;
            };

            const careerScore = getCategoryWeightedScore('career');
            const healthScore = getCategoryWeightedScore('health');
            const hobbiesScore = getCategoryWeightedScore('hobbies-habits');
            // Entertainment is tracked separately, not included in main score

            // Calculate weighted overall score
            // 36% Career + 36% Health + 28% Hobbies (Entertainment excluded)
            const overallScore = Math.round(
                (careerScore * 0.36) +
                (healthScore * 0.36) +
                (hobbiesScore * 0.28)
            );

            const statusLabel = getStatusFromScore(overallScore);

            setStats({
                score: overallScore,
                completed,
                remaining,
                atRisk,
                statusLabel,
            });
        } catch (err) {
            console.error('Failed to fetch weekly stats:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, refetch: fetchStats };
}

export function useCategoryStats(category: Category) {
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const db = await getDatabase();
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);

            const activities = await db.getAllAsync<ActivityRecord>(
                `SELECT * FROM activities WHERE category = ? AND visibility != 'archived'`,
                [category]
            );

            if (activities.length === 0) {
                setScore(0);
                return;
            }

            const logCounts = await db.getAllAsync<{ activity_id: string; count: number }>(
                `SELECT activity_id, COUNT(*) as count
                 FROM log_entries
                 WHERE logged_at >= ?
                 GROUP BY activity_id`,
                [startOfWeek.toISOString()]
            );

            const countMap = new Map<string, number>();
            logCounts.forEach((row) => {
                countMap.set(row.activity_id, row.count);
            });

            // Priority weights: High=40%, Medium=35%, Low=25%
            const PRIORITY_WEIGHTS = { high: 0.40, medium: 0.35, low: 0.25 };

            let highTotal = 0, highCount = 0;
            let mediumTotal = 0, mediumCount = 0;
            let lowTotal = 0, lowCount = 0;

            activities.forEach((activity) => {
                const count = countMap.get(activity.id) || 0;
                const activityScore = Math.min((count / activity.frequency_target) * 100, 100);
                const priority = activity.priority || 'medium';

                if (priority === 'high') {
                    highTotal += activityScore;
                    highCount++;
                } else if (priority === 'medium') {
                    mediumTotal += activityScore;
                    mediumCount++;
                } else {
                    lowTotal += activityScore;
                    lowCount++;
                }
            });

            // Calculate weighted score
            const hasHigh = highCount > 0;
            const hasMedium = mediumCount > 0;
            const hasLow = lowCount > 0;

            const highAvg = hasHigh ? highTotal / highCount : 0;
            const mediumAvg = hasMedium ? mediumTotal / mediumCount : 0;
            const lowAvg = hasLow ? lowTotal / lowCount : 0;

            let totalWeight = 0;
            let weightedSum = 0;

            if (hasHigh) {
                weightedSum += highAvg * PRIORITY_WEIGHTS.high;
                totalWeight += PRIORITY_WEIGHTS.high;
            }
            if (hasMedium) {
                weightedSum += mediumAvg * PRIORITY_WEIGHTS.medium;
                totalWeight += PRIORITY_WEIGHTS.medium;
            }
            if (hasLow) {
                weightedSum += lowAvg * PRIORITY_WEIGHTS.low;
                totalWeight += PRIORITY_WEIGHTS.low;
            }

            const categoryScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
            setScore(Math.round(categoryScore));
        } catch (err) {
            console.error(`Failed to fetch stats for ${category}:`, err);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { score, loading, refetch: fetchStats };
}

export function useFocusRecommendation(category?: Category) {
    const [recommendation, setRecommendation] = useState<{ activity: ActivityRecord; message: string } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchRecommendation = useCallback(async () => {
        try {
            const db = await getDatabase();
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);

            let query = `SELECT a.*, COALESCE(l.count, 0) as count
                         FROM activities a
                         LEFT JOIN (
                             SELECT activity_id, COUNT(*) as count
                             FROM log_entries
                             WHERE logged_at >= ?
                             GROUP BY activity_id
                         ) l ON a.id = l.activity_id
                         WHERE a.visibility != 'archived'`;

            const params: any[] = [startOfWeek.toISOString()];

            if (category) {
                query += ` AND a.category = ?`;
                params.push(category);
            }

            // Find activity with lowest completion percentage
            const activities = await db.getAllAsync<ActivityRecord & { count: number }>(query, params);

            if (activities.length === 0) {
                setRecommendation(null);
                return;
            }

            let lowestScore = 101;
            let targetActivity = null;

            for (const activity of activities) {
                const score = (activity.count / activity.frequency_target) * 100;
                if (score < lowestScore) {
                    lowestScore = score;
                    targetActivity = activity;
                }
            }

            if (targetActivity) {
                setRecommendation({
                    activity: targetActivity,
                    message: `Your ${targetActivity.name} consistency is down. Try to squeeze in a session today!`,
                });
            } else {
                setRecommendation(null);
            }

        } catch (err) {
            console.error('Failed to fetch recommendation:', err);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => {
        fetchRecommendation();
    }, [fetchRecommendation]);

    return { recommendation, loading, refetch: fetchRecommendation };
}

export function useSuggestions() {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSuggestions = useCallback(async () => {
        try {
            const db = await getDatabase();
            const newSuggestions: Suggestion[] = [];

            // Get start of current week
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);

            // Find at-risk activities
            const atRiskActivities = await db.getAllAsync<ActivityRecord & { count: number }>(
                `SELECT a.*, COALESCE(l.count, 0) as count
                 FROM activities a
                 LEFT JOIN (
                     SELECT activity_id, COUNT(*) as count
                     FROM log_entries
                     WHERE logged_at >= ?
                     GROUP BY activity_id
                 ) l ON a.id = l.activity_id
                 WHERE a.visibility != 'archived'
                 AND COALESCE(l.count, 0) < a.frequency_target`,
                [startOfWeek.toISOString()]
            );

            // Add suggestions for top at-risk activities
            atRiskActivities.slice(0, 2).forEach((activity) => {
                newSuggestions.push({
                    id: `risk_${activity.id}`,
                    message: `${activity.name} is ${activity.count}/${activity.frequency_target} this week.`,
                    cta: 'Plan a quick session',
                    type: 'at-risk',
                    activityId: activity.id,
                });
            });

            // Check if today is light on activities
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 999);

            const todayPlansCount = await db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM plans 
                 WHERE scheduled_for >= ? AND scheduled_for <= ?`,
                [todayStart.toISOString(), todayEnd.toISOString()]
            );

            if ((todayPlansCount?.count ?? 0) < 2) {
                newSuggestions.push({
                    id: 'light_day',
                    message: "Today looks light! Add a small win?",
                    cta: 'Browse activities',
                    type: 'light-day',
                });
            }

            setSuggestions(newSuggestions.slice(0, 3));
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions]);

    return { suggestions, loading, refetch: fetchSuggestions };
}

export function useActivityStats(activityId: string) {
    const [stats, setStats] = useState<ActivityStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetch() {
            try {
                const db = await getDatabase();

                const activity = await db.getFirstAsync<ActivityRecord>(
                    'SELECT * FROM activities WHERE id = ?',
                    [activityId]
                );

                if (!activity) {
                    setStats(null);
                    return;
                }

                // Get start of current week
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);

                const result = await db.getFirstAsync<{ count: number }>(
                    `SELECT COUNT(*) as count FROM log_entries
                     WHERE activity_id = ? AND logged_at >= ?`,
                    [activityId, startOfWeek.toISOString()]
                );

                const weeklyCount = result?.count ?? 0;
                const score = Math.round(Math.min((weeklyCount / activity.frequency_target) * 100, 100));
                const status = getStatusFromScore(score);

                setStats({
                    activity,
                    weeklyCount,
                    targetCount: activity.frequency_target,
                    score,
                    status,
                });
            } catch (err) {
                console.error('Failed to fetch activity stats:', err);
            } finally {
                setLoading(false);
            }
        }
        fetch();
    }, [activityId]);

    return { stats, loading };
}

export interface ProfileStats {
    dayStreak: number;
    totalActivities: number;
    totalLogs: number;
}

export function useProfileStats() {
    const [stats, setStats] = useState<ProfileStats>({
        dayStreak: 0,
        totalActivities: 0,
        totalLogs: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const db = await getDatabase();

            // Get total activities count (non-archived)
            const activitiesResult = await db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM activities WHERE visibility != 'archived'`
            );
            const totalActivities = activitiesResult?.count ?? 0;

            // Get total logs count
            const logsResult = await db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM log_entries`
            );
            const totalLogs = logsResult?.count ?? 0;

            // Calculate day streak (consecutive days with at least 1 log)
            // Get distinct dates with logs, ordered descending
            const logDates = await db.getAllAsync<{ log_date: string }>(
                `SELECT DISTINCT DATE(logged_at) as log_date 
                 FROM log_entries 
                 ORDER BY log_date DESC`
            );

            let dayStreak = 0;
            if (logDates.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Check if there's a log today or yesterday (streak continues)
                const mostRecentLogDate = new Date(logDates[0].log_date);
                mostRecentLogDate.setHours(0, 0, 0, 0);

                const diffDays = Math.floor((today.getTime() - mostRecentLogDate.getTime()) / (1000 * 60 * 60 * 24));

                // Only count streak if most recent log is today or yesterday
                if (diffDays <= 1) {
                    dayStreak = 1;
                    let expectedDate = new Date(mostRecentLogDate);

                    for (let i = 1; i < logDates.length; i++) {
                        const currentLogDate = new Date(logDates[i].log_date);
                        currentLogDate.setHours(0, 0, 0, 0);
                        expectedDate.setDate(expectedDate.getDate() - 1);

                        const dayDiff = Math.floor((expectedDate.getTime() - currentLogDate.getTime()) / (1000 * 60 * 60 * 24));

                        if (dayDiff === 0) {
                            dayStreak++;
                        } else {
                            break; // Streak broken
                        }
                    }
                }
            }

            setStats({
                dayStreak,
                totalActivities,
                totalLogs,
            });
        } catch (err) {
            console.error('Failed to fetch profile stats:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, refetch: fetchStats };
}
