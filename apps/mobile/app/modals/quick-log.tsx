import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';
import { usePinnedActivities, useRecentActivities } from '../../src/hooks/useActivities';
import { createLogEntry } from '../../src/hooks/useLogEntries';

// Helper to format relative time
function formatRelativeTime(isoString: string | null): string {
    if (!isoString) return 'Never';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

export default function QuickLogModal() {
    const [searchQuery, setSearchQuery] = React.useState('');
    const { activities: pinnedActivities, loading: pinnedLoading } = usePinnedActivities();
    const { activities: recentActivities, loading: recentLoading, refetch: refetchRecent } = useRecentActivities();

    const handleClose = () => {
        router.back();
    };

    const handleQuickLog = async (activityId: string, activityName: string) => {
        try {
            // Trigger haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Create a log entry with default value
            await createLogEntry(activityId, 1);

            console.log('Quick logged:', activityName);
            refetchRecent();
            router.back();
        } catch (error) {
            console.error('Failed to log:', error);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handlePlan = (activityId: string) => {
        router.push(`/modals/plan?activityId=${activityId}`);
    };

    // Filter activities by search query
    const filteredPinned = pinnedActivities.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredRecent = recentActivities.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.overlay}>
            <Pressable style={styles.backdrop} onPress={handleClose} />
            <View style={styles.sheet}>
                {/* Handle */}
                <View style={styles.handle} />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Quick Log</Text>
                    <Pressable onPress={handleClose}>
                        <Text style={styles.closeButton}>✕</Text>
                    </Pressable>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search activities..."
                        placeholderTextColor={colors.text.tertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Pinned Activities */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Pinned</Text>
                        {pinnedLoading ? (
                            <ActivityIndicator color={colors.primary.main} />
                        ) : filteredPinned.length > 0 ? (
                            <View style={styles.pinnedGrid}>
                                {filteredPinned.map((activity) => (
                                    <Pressable
                                        key={activity.id}
                                        style={styles.pinnedCard}
                                        onPress={() => handleQuickLog(activity.id, activity.name)}
                                        onLongPress={() => handlePlan(activity.id)}
                                    >
                                        <View style={[styles.pinnedIcon, { backgroundColor: activity.color }]}>
                                            <Text style={styles.pinnedIconText}>✓</Text>
                                        </View>
                                        <Text style={styles.pinnedName} numberOfLines={1}>{activity.name}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>No pinned activities</Text>
                        )}
                    </View>

                    {/* Recent Activities */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent</Text>
                        {recentLoading ? (
                            <ActivityIndicator color={colors.primary.main} />
                        ) : filteredRecent.length > 0 ? (
                            filteredRecent.map((activity) => (
                                <Pressable
                                    key={activity.id}
                                    style={styles.recentRow}
                                    onPress={() => handleQuickLog(activity.id, activity.name)}
                                >
                                    <View style={[styles.recentDot, { backgroundColor: activity.color }]} />
                                    <View style={styles.recentInfo}>
                                        <Text style={styles.recentName}>{activity.name}</Text>
                                        <Text style={styles.recentTime}>
                                            {formatRelativeTime(activity.last_logged)}
                                        </Text>
                                    </View>
                                    <View style={styles.recentActions}>
                                        <Pressable
                                            style={styles.logButton}
                                            onPress={() => handleQuickLog(activity.id, activity.name)}
                                        >
                                            <Text style={styles.logButtonText}>✓ Log</Text>
                                        </Pressable>
                                        <Pressable
                                            style={styles.planButton}
                                            onPress={() => handlePlan(activity.id)}
                                        >
                                            <Text style={styles.planButtonText}>⏰</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No recent activities</Text>
                        )}
                    </View>

                    <View style={{ height: spacing.xl }} />
                </ScrollView>
            </View>
        </View>
    );
}


const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    sheet: {
        backgroundColor: colors.background.secondary,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        maxHeight: '80%',
        paddingBottom: 40,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: colors.border.default,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
    },
    closeButton: {
        fontSize: 20,
        color: colors.text.secondary,
        padding: spacing.sm,
    },
    searchContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    searchInput: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text.primary,
    },
    content: {
        paddingHorizontal: spacing.lg,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.md,
    },
    pinnedGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    pinnedCard: {
        width: '31%',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
        ...shadows.sm,
    },
    pinnedIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    pinnedIconText: {
        fontSize: 20,
        color: colors.text.primary,
        fontWeight: '600',
    },
    pinnedName: {
        fontSize: 13,
        color: colors.text.primary,
        fontWeight: '500',
        textAlign: 'center',
    },
    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    recentDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.md,
    },
    recentInfo: {
        flex: 1,
    },
    recentName: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text.primary,
    },
    recentTime: {
        fontSize: 13,
        color: colors.text.secondary,
    },
    recentActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    logButton: {
        backgroundColor: colors.primary.main,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
    },
    logButtonText: {
        color: colors.primary.contrast,
        fontSize: 14,
        fontWeight: '600',
    },
    planButton: {
        backgroundColor: colors.background.elevated,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.md,
    },
    planButtonText: {
        fontSize: 16,
    },
    emptyText: {
        color: colors.text.secondary,
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: spacing.md,
    },
});
