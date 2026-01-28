import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Switch,
    ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, borderRadius } from '../../src/theme';
import { useActivities } from '../../src/hooks/useActivities';
import { createPlan } from '../../src/hooks/usePlans';

export default function PlanModal() {
    const params = useLocalSearchParams();
    const { activities, loading } = useActivities();

    const [selectedActivityId, setSelectedActivityId] = React.useState(params.activityId as string || '');
    const [selectedDateOffset, setSelectedDateOffset] = React.useState(0); // 0=today, 1=tomorrow, etc.
    const [selectedHour, setSelectedHour] = React.useState(18); // 6 PM
    const [duration, setDuration] = React.useState(30);
    const [reminderEnabled, setReminderEnabled] = React.useState(true);
    const [showActivityPicker, setShowActivityPicker] = React.useState(false);

    const selectedActivity = activities.find(a => a.id === selectedActivityId);

    // Date options
    const dateOptions = React.useMemo(() => {
        const today = new Date();
        return [0, 1, 2, 3].map(offset => {
            const date = new Date(today);
            date.setDate(today.getDate() + offset);
            const dayName = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' :
                date.toLocaleDateString('en-US', { weekday: 'short' });
            return { offset, label: dayName };
        });
    }, []);

    const handleSave = async () => {
        if (!selectedActivityId) {
            console.log('Please select an activity');
            return;
        }

        try {
            const scheduledDate = new Date();
            scheduledDate.setDate(scheduledDate.getDate() + selectedDateOffset);
            scheduledDate.setHours(selectedHour, 0, 0, 0);

            await createPlan(selectedActivityId, scheduledDate, duration);
            console.log('Plan saved');
            router.back();
        } catch (error) {
            console.error('Failed to save plan:', error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.cancelButton}>Cancel</Text>
                </Pressable>
                <Text style={styles.title}>Plan Activity</Text>
                <Pressable onPress={handleSave}>
                    <Text style={[styles.saveButton, !selectedActivityId && styles.saveButtonDisabled]}>
                        Save
                    </Text>
                </Pressable>
            </View>

            <ScrollView style={styles.content}>
                {/* Activity Selector */}
                <View style={styles.field}>
                    <Text style={styles.label}>Activity</Text>
                    <Pressable
                        style={styles.selector}
                        onPress={() => setShowActivityPicker(!showActivityPicker)}
                    >
                        {selectedActivity ? (
                            <>
                                <View style={[styles.selectorDot, { backgroundColor: selectedActivity.color }]} />
                                <Text style={styles.selectorText}>{selectedActivity.name}</Text>
                            </>
                        ) : (
                            <Text style={[styles.selectorText, styles.placeholderText]}>
                                Select an activity
                            </Text>
                        )}
                        <Text style={styles.selectorArrow}>›</Text>
                    </Pressable>

                    {showActivityPicker && (
                        <View style={styles.pickerDropdown}>
                            {loading ? (
                                <ActivityIndicator color={colors.primary.main} />
                            ) : (
                                activities.map(activity => (
                                    <Pressable
                                        key={activity.id}
                                        style={[
                                            styles.pickerItem,
                                            selectedActivityId === activity.id && styles.pickerItemActive
                                        ]}
                                        onPress={() => {
                                            setSelectedActivityId(activity.id);
                                            setShowActivityPicker(false);
                                        }}
                                    >
                                        <View style={[styles.selectorDot, { backgroundColor: activity.color }]} />
                                        <Text style={styles.pickerItemText}>{activity.name}</Text>
                                    </Pressable>
                                ))
                            )}
                        </View>
                    )}
                </View>

                {/* Date Selector */}
                <View style={styles.field}>
                    <Text style={styles.label}>Date</Text>
                    <View style={styles.quickDates}>
                        {dateOptions.map((option) => (
                            <Pressable
                                key={option.offset}
                                style={[
                                    styles.quickDateButton,
                                    selectedDateOffset === option.offset && styles.quickDateButtonActive,
                                ]}
                                onPress={() => setSelectedDateOffset(option.offset)}
                            >
                                <Text style={[
                                    styles.quickDateText,
                                    selectedDateOffset === option.offset && styles.quickDateTextActive,
                                ]}>
                                    {option.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Time Selector */}
                <View style={styles.field}>
                    <Text style={styles.label}>Time</Text>
                    <View style={styles.quickDates}>
                        {[9, 12, 15, 18, 21].map((hour) => (
                            <Pressable
                                key={hour}
                                style={[
                                    styles.quickDateButton,
                                    selectedHour === hour && styles.quickDateButtonActive,
                                ]}
                                onPress={() => setSelectedHour(hour)}
                            >
                                <Text style={[
                                    styles.quickDateText,
                                    selectedHour === hour && styles.quickDateTextActive,
                                ]}>
                                    {hour <= 12 ? `${hour}AM` : `${hour - 12}PM`}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Duration */}
                <View style={styles.field}>
                    <Text style={styles.label}>Duration (minutes)</Text>
                    <View style={styles.quickDates}>
                        {[15, 30, 45, 60, 90].map((dur) => (
                            <Pressable
                                key={dur}
                                style={[
                                    styles.quickDateButton,
                                    duration === dur && styles.quickDateButtonActive,
                                ]}
                                onPress={() => setDuration(dur)}
                            >
                                <Text style={[
                                    styles.quickDateText,
                                    duration === dur && styles.quickDateTextActive,
                                ]}>
                                    {dur}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Reminder Toggle */}
                <View style={styles.reminderRow}>
                    <View>
                        <Text style={styles.reminderLabel}>Reminder</Text>
                        <Text style={styles.reminderSubtext}>15 minutes before</Text>
                    </View>
                    <Switch
                        value={reminderEnabled}
                        onValueChange={setReminderEnabled}
                        trackColor={{ false: colors.background.tertiary, true: colors.primary.main }}
                        thumbColor={colors.text.primary}
                    />
                </View>
            </ScrollView>
        </View>
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
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    cancelButton: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    saveButton: {
        fontSize: 16,
        color: colors.primary.main,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    field: {
        marginBottom: spacing.xl,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    selectorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: spacing.md,
    },
    selectorText: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
    },
    selectorArrow: {
        fontSize: 20,
        color: colors.text.tertiary,
    },
    quickDates: {
        flexDirection: 'row',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    quickDateButton: {
        backgroundColor: colors.background.secondary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        minWidth: 60,
        alignItems: 'center',
    },
    quickDateButtonActive: {
        backgroundColor: colors.primary.main,
    },
    quickDateText: {
        fontSize: 14,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    quickDateTextActive: {
        color: colors.primary.contrast,
    },
    reminderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    reminderLabel: {
        fontSize: 16,
        color: colors.text.primary,
        fontWeight: '500',
    },
    reminderSubtext: {
        fontSize: 13,
        color: colors.text.secondary,
        marginTop: 2,
    },
    saveButtonDisabled: {
        color: colors.text.tertiary,
    },
    placeholderText: {
        color: colors.text.tertiary,
    },
    pickerDropdown: {
        marginTop: spacing.sm,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        maxHeight: 200,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
    },
    pickerItemActive: {
        backgroundColor: colors.primary.main + '20',
    },
    pickerItemText: {
        fontSize: 15,
        color: colors.text.primary,
    },
});
