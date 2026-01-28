import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';
import { useTodayPlans, completePlan } from '../../src/hooks/usePlans';
import { useWeeklyStats, useSuggestions, useFocusRecommendation, useProfileStats } from '../../src/hooks/useStats';

// ... (rest of imports)

// ... (component code)



// Helper to get greeting based on time of day
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning! ☀️';
    if (hour < 17) return 'Good afternoon! 🌤️';
    return 'Good evening! 🌙';
}

// Helper to format time
function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function HomeScreen() {
    const { plans: todayPlans, loading: plansLoading, refetch: refetchPlans } = useTodayPlans();
    const { stats, loading: statsLoading } = useWeeklyStats();
    const { suggestions, loading: suggestionsLoading } = useSuggestions();
    const { recommendation } = useFocusRecommendation();
    const { stats: profileStats, loading: profileStatsLoading } = useProfileStats();

    const handleCompletePlan = async (planId: string) => {
        await completePlan(planId);
        refetchPlans();
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return colors.status.onTrack;
        if (score >= 50) return colors.status.catchingUp;
        return colors.status.needsLove;
    };

    const getMotivationalMessage = (score: number) => {
        if (score >= 80) return "You're crushing it! 🎉";
        if (score >= 50) return "Nice progress! Keep going 💪";
        return "Every step counts! Start small 🌱";
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()}</Text>
                        <Text style={styles.date}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </Text>
                    </View>
                    <Pressable
                        style={styles.profileButton}
                        onPress={() => router.push('/profile')}
                    >
                        <Text style={styles.profileIcon}>👤</Text>
                    </Pressable>
                </View>

                {/* Focus Recommendation */}
                {recommendation && (
                    <View style={styles.focusContainer}>
                        <Text style={styles.focusTitle}>Focus for this week</Text>
                        <Text style={styles.focusText}>
                            {recommendation.message}
                        </Text>
                    </View>
                )}

                {/* Today's Plans */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today's Plans</Text>
                    {plansLoading ? (
                        <ActivityIndicator color={colors.primary.main} />
                    ) : todayPlans.length > 0 ? (
                        <View style={styles.plansList}>
                            {todayPlans.map((plan) => (
                                <View key={plan.id} style={styles.planCard}>
                                    <View style={[styles.planColorDot, { backgroundColor: plan.activity_color }]} />
                                    <View style={styles.planInfo}>
                                        <Text style={styles.planName}>{plan.activity_name}</Text>
                                        <Text style={styles.planTime}>
                                            {formatTime(plan.scheduled_for)}
                                            {plan.duration_minutes ? ` · ${plan.duration_minutes} min` : ''}
                                        </Text>
                                    </View>
                                    <View style={styles.planActions}>
                                        <Pressable
                                            style={styles.actionButton}
                                            onPress={() => handleCompletePlan(plan.id)}
                                        >
                                            <Text style={styles.actionButtonText}>✓</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No plans for today</Text>
                            <Pressable style={styles.addButton} onPress={() => router.push('/modals/plan')}>
                                <Text style={styles.addButtonText}>+ Add a plan</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Consistency Score & Stats Overlay */}
                <View style={styles.section}>
                    <View style={styles.scoreCard}>
                        {statsLoading ? (
                            <ActivityIndicator color={colors.primary.main} />
                        ) : (
                            <>
                                <View style={styles.scoreHeader}>
                                    <Text style={styles.scoreLabel}>This Week</Text>
                                    <Text style={[styles.scoreValue, { color: getScoreColor(stats.score) }]}>
                                        {stats.score}
                                    </Text>
                                </View>
                                <Text style={styles.scoreMessage}>{getMotivationalMessage(stats.score)}</Text>

                                {/* Stats Overlay Grid */}
                                <View style={styles.statsGrid}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.completed}</Text>
                                        <Text style={styles.statLabel}>Completed</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.remaining}</Text>
                                        <Text style={styles.statLabel}>Remaining</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>🔥 {profileStatsLoading ? '-' : profileStats.dayStreak}</Text>
                                        <Text style={styles.statLabel}>Day Streak</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.atRisk}</Text>
                                        <Text style={styles.statLabel}>At Risk</Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Smart Suggestions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Suggested Next Moves</Text>
                    {suggestionsLoading ? (
                        <ActivityIndicator color={colors.primary.main} />
                    ) : suggestions.length > 0 ? (
                        suggestions.map((suggestion) => (
                            <View key={suggestion.id} style={styles.suggestionCard}>
                                <Text style={styles.suggestionMessage}>{suggestion.message}</Text>
                                <Pressable
                                    style={styles.suggestionCta}
                                    onPress={() => router.push(suggestion.type === 'at-risk' ? '/modals/plan' : '/modals/quick-log')}
                                >
                                    <Text style={styles.suggestionCtaText}>{suggestion.cta}</Text>
                                </Pressable>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>You're all caught up! 🎉</Text>
                    )}
                </View>

                {/* Bottom spacing for FAB */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Floating Action Button */}
            <Pressable style={styles.fab} onPress={() => router.push('/modals/quick-log')}>
                <Text style={styles.fabText}>+</Text>
            </Pressable>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.sm,
    },
    profileIcon: {
        fontSize: 20,
    },
    greeting: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    date: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    plansList: {
        gap: spacing.sm,
    },
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        ...shadows.sm,
    },
    planColorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.md,
    },
    planInfo: {
        flex: 1,
    },
    planName: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text.primary,
        marginBottom: 2,
    },
    planTime: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    planActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary.main + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        color: colors.primary.main,
        fontSize: 18,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
    },
    emptyText: {
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    addButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.primary.main,
        borderRadius: borderRadius.md,
    },
    addButtonText: {
        color: colors.primary.contrast,
        fontWeight: '600',
    },
    scoreCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        ...shadows.md,
    },
    scoreHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    scoreLabel: {
        fontSize: 14,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    scoreValue: {
        fontSize: 48,
        fontWeight: '700',
        color: colors.status.onTrack,
    },
    scoreMessage: {
        fontSize: 16,
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    scoreChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
    },
    chipWarning: {
        backgroundColor: colors.status.needsLove + '20',
    },
    chipEmoji: {
        fontSize: 14,
    },
    chipText: {
        fontSize: 13,
        color: colors.text.secondary,
    },
    suggestionCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary.main,
    },
    suggestionMessage: {
        fontSize: 15,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    suggestionCta: {
        alignSelf: 'flex-start',
    },
    suggestionCtaText: {
        fontSize: 14,
        color: colors.primary.main,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: spacing.lg,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary.main,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.lg,
    },
    fabText: {
        fontSize: 32,
        color: colors.primary.contrast,
        fontWeight: '300',
        marginTop: -2,
    },
    focusContainer: {
        backgroundColor: colors.primary.main + '10',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary.main,
    },
    focusTitle: {
        fontSize: 12,
        color: colors.primary.main,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    focusText: {
        fontSize: 14,
        color: colors.text.primary,
        lineHeight: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
        paddingTop: spacing.lg,
    },
    statItem: {
        flex: 1,
        minWidth: '40%',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: colors.text.secondary,
    },
});
