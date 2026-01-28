import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';

// Generate heatmap data for past 365 days
function generateHeatmapData() {
    const data = [];
    for (let i = 364; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const intensity = Math.random() > 0.4 ? Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4 : 0;
        data.push({ date: date.toISOString().split('T')[0], intensity });
    }
    return data;
}

const heatmapData = generateHeatmapData();

// Sample logs
const recentLogs = [
    { id: '1', timestamp: '2024-01-18 09:30', value: 3, note: 'Solved 3 medium problems' },
    { id: '2', timestamp: '2024-01-17 10:15', value: 2, note: 'Easy problems today' },
    { id: '3', timestamp: '2024-01-16 08:45', value: 4, note: 'Great session!' },
    { id: '4', timestamp: '2024-01-14 11:00', value: 2, note: null },
    { id: '5', timestamp: '2024-01-13 09:00', value: 3, note: 'Dynamic programming' },
];

// Sample upcoming plans
const upcomingPlans = [
    { id: '1', scheduledAt: 'Today, 6:00 PM', duration: '30 min' },
    { id: '2', scheduledAt: 'Tomorrow, 9:00 AM', duration: '45 min' },
];

export default function ActivityDetailScreen() {
    const { id } = useLocalSearchParams();

    // Mock activity data
    const activity = {
        id,
        name: 'LeetCode',
        category: 'career',
        frequency: '5× week',
        color: '#3B82F6',
        score: 85,
        status: 'on-track',
        completed: 4,
        target: 5,
        remaining: 1,
    };

    const statusColors = {
        'on-track': colors.status.onTrack,
        'catching-up': colors.status.catchingUp,
        'needs-love': colors.status.needsLove,
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>‹ Back</Text>
                </Pressable>
                <Pressable style={styles.moreButton}>
                    <Text style={styles.moreText}>•••</Text>
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Activity Title */}
                <View style={styles.titleSection}>
                    <View style={[styles.colorDot, { backgroundColor: activity.color }]} />
                    <View>
                        <Text style={styles.activityName}>{activity.name}</Text>
                        <Text style={styles.activityFrequency}>{activity.frequency}</Text>
                    </View>
                </View>

                {/* Score Card */}
                <View style={styles.scoreCard}>
                    <View style={styles.scoreRow}>
                        <View>
                            <Text style={styles.scoreLabel}>This Week</Text>
                            <Text style={[styles.scoreValue, { color: statusColors[activity.status as keyof typeof statusColors] }]}>
                                {activity.score}
                            </Text>
                            <Text style={styles.statusText}>On Track</Text>
                        </View>
                        <View style={styles.progressInfo}>
                            <Text style={styles.progressText}>
                                {activity.completed}/{activity.target} sessions
                            </Text>
                            <Text style={styles.remainingText}>
                                {activity.remaining} more to go
                            </Text>
                        </View>
                    </View>
                    <View style={styles.actionButtons}>
                        <Pressable style={styles.logButton}>
                            <Text style={styles.logButtonText}>Log Now</Text>
                        </Pressable>
                        <Pressable style={styles.planButton}>
                            <Text style={styles.planButtonText}>Plan Session</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Heatmap */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Heatmap</Text>
                    <View style={styles.heatmapContainer}>
                        <View style={styles.heatmap}>
                            {heatmapData.map((day, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.heatmapCell,
                                        { backgroundColor: colors.heatmap[day.intensity] },
                                    ]}
                                />
                            ))}
                        </View>
                        <View style={styles.heatmapLegend}>
                            <Text style={styles.legendText}>Less</Text>
                            {[0, 1, 2, 3, 4].map((level) => (
                                <View
                                    key={level}
                                    style={[
                                        styles.legendCell,
                                        { backgroundColor: colors.heatmap[level as 0 | 1 | 2 | 3 | 4] },
                                    ]}
                                />
                            ))}
                            <Text style={styles.legendText}>More</Text>
                        </View>
                    </View>
                </View>

                {/* Upcoming Plans */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Upcoming Plans</Text>
                    {upcomingPlans.map((plan) => (
                        <View key={plan.id} style={styles.planCard}>
                            <View style={styles.planInfo}>
                                <Text style={styles.planTime}>{plan.scheduledAt}</Text>
                                <Text style={styles.planDuration}>{plan.duration}</Text>
                            </View>
                            <Pressable style={styles.planCompleteButton}>
                                <Text style={styles.planCompleteText}>✓</Text>
                            </Pressable>
                        </View>
                    ))}
                </View>

                {/* Recent Logs */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Logs</Text>
                    {recentLogs.map((log) => (
                        <View key={log.id} style={styles.logCard}>
                            <View style={styles.logHeader}>
                                <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                                <Text style={styles.logValue}>{log.value} problems</Text>
                            </View>
                            {log.note && <Text style={styles.logNote}>{log.note}</Text>}
                        </View>
                    ))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    backButton: {
        padding: spacing.sm,
    },
    backText: {
        fontSize: 18,
        color: colors.primary.main,
    },
    moreButton: {
        padding: spacing.sm,
    },
    moreText: {
        fontSize: 20,
        color: colors.text.secondary,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    titleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    colorDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: spacing.md,
    },
    activityName: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text.primary,
    },
    activityFrequency: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    scoreCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        ...shadows.sm,
    },
    scoreRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    scoreLabel: {
        fontSize: 13,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
    },
    scoreValue: {
        fontSize: 48,
        fontWeight: '700',
    },
    statusText: {
        fontSize: 14,
        color: colors.status.onTrack,
        fontWeight: '600',
    },
    progressInfo: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    progressText: {
        fontSize: 18,
        color: colors.text.primary,
        fontWeight: '600',
    },
    remainingText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    logButton: {
        flex: 1,
        backgroundColor: colors.primary.main,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    logButtonText: {
        color: colors.primary.contrast,
        fontSize: 16,
        fontWeight: '600',
    },
    planButton: {
        flex: 1,
        backgroundColor: colors.background.tertiary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    planButtonText: {
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: '600',
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
    heatmapContainer: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    heatmap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
    },
    heatmapCell: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    heatmapLegend: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: spacing.md,
        gap: spacing.xs,
    },
    legendCell: {
        width: 12,
        height: 12,
        borderRadius: 2,
    },
    legendText: {
        fontSize: 11,
        color: colors.text.tertiary,
    },
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    planInfo: {
        flex: 1,
    },
    planTime: {
        fontSize: 16,
        color: colors.text.primary,
        fontWeight: '500',
    },
    planDuration: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    planCompleteButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary.main + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    planCompleteText: {
        color: colors.primary.main,
        fontSize: 18,
        fontWeight: '600',
    },
    logCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logTimestamp: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    logValue: {
        fontSize: 16,
        color: colors.text.primary,
        fontWeight: '600',
    },
    logNote: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: spacing.xs,
    },
});
