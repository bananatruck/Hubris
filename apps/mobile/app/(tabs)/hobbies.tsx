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
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';
import { useActivities } from '../../src/hooks/useActivities';
import { useFocusRecommendation, useActivityStats } from '../../src/hooks/useStats';

// Activity card component
interface ActivityCardProps {
    id: string;
    name: string;
    frequency: string;
    score: number;
    status: string;
    color: string;
    onPress: () => void;
    onLog: () => void;
}

function ActivityCard({ id: _id, name, frequency, score, status, color, onPress, onLog }: ActivityCardProps) {
    const statusColors: Record<string, string> = {
        'On Track': colors.status.onTrack,
        'Catching Up': colors.status.catchingUp,
        'Needs Love': colors.status.needsLove,
    };

    return (
        <Pressable style={styles.activityCard} onPress={onPress}>
            <View style={styles.activityHeader}>
                <View style={[styles.activityDot, { backgroundColor: color }]} />
                <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{name}</Text>
                    <Text style={styles.activityFrequency}>{frequency}</Text>
                </View>
                <View style={styles.activityScore}>
                    <Text style={[styles.scoreNumber, { color: statusColors[status] || colors.text.primary }]}>{score}</Text>
                    <Text style={[styles.statusLabel, { color: statusColors[status] || colors.text.secondary }]}>{status}</Text>
                </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
                <Pressable style={styles.quickAction} onPress={onLog}>
                    <Text style={styles.quickActionText}>Log</Text>
                </Pressable>
            </View>
        </Pressable>
    );
}

function ActivityCardWithStats({ activity }: { activity: any }) {
    const router = useRouter();
    const { stats, loading } = useActivityStats(activity.id);

    if (loading || !stats) return null;

    return (
        <ActivityCard
            id={activity.id}
            name={activity.name}
            frequency={`${activity.frequency_target}× ${activity.frequency_rate}`}
            score={stats.score}
            status={stats.status}
            color={activity.color}
            onPress={() => router.push({
                pathname: '/modals/activity-form',
                params: { id: activity.id }
            })}
            onLog={() => router.push(`/modals/quick-log?activityId=${activity.id}`)}
        />
    );
}

export default function HobbiesScreen() {
    const router = useRouter();
    const { activities, loading } = useActivities('hobbies-habits');
    const { recommendation } = useFocusRecommendation('hobbies-habits');

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Hobbies & Habits 🎨</Text>
                </View>

                {/* Focus Recommendation */}
                {recommendation && (
                    <View style={styles.recommendationBox}>
                        <Text style={styles.recommendationTitle}>Focus for this week</Text>
                        <Text style={styles.recommendationText}>{recommendation.message}</Text>
                    </View>
                )}

                {/* Activity List */}
                <View style={styles.activityList}>
                    {loading ? (
                        <ActivityIndicator color={colors.primary.main} />
                    ) : (
                        activities.map((activity) => (
                            <ActivityCardWithStats key={activity.id} activity={activity} />
                        ))
                    )}
                </View>

                {/* Add Activity Button */}
                <Pressable
                    style={styles.addActivityButton}
                    onPress={() => router.push({
                        pathname: '/modals/activity-form',
                        params: { category: 'hobbies-habits' }
                    })}
                >
                    <Text style={styles.addActivityText}>+ Add Hobby or Habit</Text>
                </Pressable>

                <View style={{ height: 100 }} />
            </ScrollView>
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
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text.primary,
    },
    categoryScoreBox: {
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
    },
    categoryScoreValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    categoryScoreLabel: {
        fontSize: 11,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    statBox: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.status.onTrack,
    },
    statLabel: {
        fontSize: 12,
        color: colors.text.secondary,
        marginTop: spacing.xs,
    },
    activityList: {
        gap: spacing.md,
    },
    activityCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        ...shadows.sm,
    },
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    activityDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: spacing.md,
    },
    activityInfo: {
        flex: 1,
    },
    activityName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    activityFrequency: {
        fontSize: 13,
        color: colors.text.secondary,
    },
    activityScore: {
        alignItems: 'flex-end',
    },
    scoreNumber: {
        fontSize: 24,
        fontWeight: '700',
    },
    statusLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
    },
    recommendationBox: {
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: colors.status.needsLove,
    },
    recommendationTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.status.needsLove,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    recommendationText: {
        fontSize: 16,
        color: colors.text.primary,
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    miniHeatmap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
        marginBottom: spacing.md,
    },
    heatmapCell: {
        width: 8,
        height: 8,
        borderRadius: 2,
    },
    quickActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    quickAction: {
        backgroundColor: colors.primary.main + '20',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
    },
    quickActionText: {
        color: colors.primary.main,
        fontSize: 13,
        fontWeight: '600',
    },
    addActivityButton: {
        marginTop: spacing.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        borderRadius: borderRadius.lg,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    addActivityText: {
        color: colors.text.secondary,
        fontSize: 15,
    },
});
