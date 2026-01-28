import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    ScrollView,
    Alert,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';
import { useActivities, Category } from '../../src/hooks/useActivities';
import { ActivityRecord } from '../../src/db/database';
import { scheduleActivityReminder, cancelActivityReminders, requestNotificationPermissions } from '../../src/services/notifications';

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
    { id: 'career', label: 'Career', icon: '💼' },
    { id: 'health', label: 'Health', icon: '❤️' },
    { id: 'hobbies-habits', label: 'Hobbies', icon: '🎨' },
    { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
];

const PRESET_COLORS = [
    '#EF4444', // Red
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#EC4899', // Pink
];

export default function ActivityFormScreen() {
    const params = useLocalSearchParams();
    const { createActivity, updateActivity } = useActivities();

    const isEditing = !!params.id;
    const initialCategory = (params.category as Category) || 'career';

    const [name, setName] = useState(params.name as string || '');
    const [category, setCategory] = useState<Category>(initialCategory);
    const [subCategory] = useState(params.subCategory as string || '');
    const [frequencyTarget, setFrequencyTarget] = useState(params.frequencyTarget ? String(params.frequencyTarget) : '1');
    const [frequencyRate, setFrequencyRate] = useState(params.frequencyRate as string || 'week');
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>((params.priority as 'high' | 'medium' | 'low') || 'medium');
    const [color, setColor] = useState(params.color as string || PRESET_COLORS[4]);

    // Reminder state
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderTime, setReminderTime] = useState('09:00');
    const [reminderDays, setReminderDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri

    // Hidden fields for entertainment items
    const externalId = params.externalId as string;
    const imageUrl = params.imageUrl as string;

    const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const toggleDay = (day: number) => {
        if (reminderDays.includes(day)) {
            setReminderDays(reminderDays.filter(d => d !== day));
        } else {
            setReminderDays([...reminderDays, day].sort());
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter an activity name');
            return;
        }

        try {
            const activityData: Omit<ActivityRecord, 'id' | 'created_at' | 'updated_at'> = {
                name,
                category,
                sub_category: subCategory || undefined,
                color,
                frequency_target: parseInt(frequencyTarget) || 1,
                frequency_rate: frequencyRate as any,
                priority,
                reminder_enabled: reminderEnabled ? 1 : 0,
                reminder_time: reminderEnabled ? reminderTime : null,
                reminder_days: reminderEnabled ? JSON.stringify(reminderDays) : null,
                template: 'count',
                external_id: externalId,
                image_url: imageUrl,
                visibility: 'active',
            };

            let activityId = params.id as string;
            if (isEditing) {
                await updateActivity(activityId, activityData);
            } else {
                activityId = await createActivity(activityData);
            }

            // Handle notification scheduling
            if (reminderEnabled && reminderDays.length > 0) {
                const hasPermission = await requestNotificationPermissions();
                if (hasPermission) {
                    await scheduleActivityReminder(activityId, name, reminderTime, reminderDays);
                } else {
                    Alert.alert('Notifications', 'Please enable notifications in settings to receive reminders.');
                }
            } else {
                await cancelActivityReminders(activityId);
            }

            router.back();
        } catch (error) {
            console.error('Error saving activity:', error);
            Alert.alert('Error', 'Failed to save activity');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>✕</Text>
                </Pressable>
                <Text style={styles.title}>{isEditing ? 'Edit Activity' : 'New Activity'}</Text>
                <Pressable onPress={handleSave} style={styles.saveButton}>
                    <Text style={styles.saveButtonText}>Save</Text>
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>Activity Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g., Gym, Reading, Coding"
                        placeholderTextColor={colors.text.tertiary}
                        autoFocus={!isEditing}
                    />
                </View>

                {/* Category Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.categoryGrid}>
                        {CATEGORIES.map((cat) => (
                            <Pressable
                                key={cat.id}
                                style={[
                                    styles.categoryOption,
                                    category === cat.id && styles.categoryOptionActive,
                                    { borderColor: category === cat.id ? colors.primary.main : colors.border.default }
                                ]}
                                onPress={() => setCategory(cat.id)}
                            >
                                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                <Text style={[
                                    styles.categoryLabel,
                                    category === cat.id && styles.categoryLabelActive
                                ]}>{cat.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Frequency Settings */}
                <View style={styles.section}>
                    <Text style={styles.label}>Frequency Goal</Text>
                    <View style={styles.frequencyRow}>
                        <TextInput
                            style={styles.frequencyInput}
                            value={frequencyTarget}
                            onChangeText={setFrequencyTarget}
                            keyboardType="numeric"
                            maxLength={2}
                        />
                        <Text style={styles.frequencyText}>times per</Text>
                        <View style={styles.frequencyToggle}>
                            <Pressable
                                style={[styles.toggleOption, frequencyRate === 'week' && styles.toggleOptionActive]}
                                onPress={() => setFrequencyRate('week')}
                            >
                                <Text style={[styles.toggleText, frequencyRate === 'week' && styles.toggleTextActive]}>Week</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.toggleOption, frequencyRate === 'day' && styles.toggleOptionActive]}
                                onPress={() => setFrequencyRate('day')}
                            >
                                <Text style={[styles.toggleText, frequencyRate === 'day' && styles.toggleTextActive]}>Day</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Priority Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Priority</Text>
                    <View style={styles.priorityRow}>
                        <Pressable
                            style={[styles.priorityOption, priority === 'high' && styles.priorityHigh]}
                            onPress={() => setPriority('high')}
                        >
                            <Text style={[styles.priorityText, priority === 'high' && styles.priorityTextActive]}>High</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.priorityOption, priority === 'medium' && styles.priorityMedium]}
                            onPress={() => setPriority('medium')}
                        >
                            <Text style={[styles.priorityText, priority === 'medium' && styles.priorityTextActive]}>Medium</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.priorityOption, priority === 'low' && styles.priorityLow]}
                            onPress={() => setPriority('low')}
                        >
                            <Text style={[styles.priorityText, priority === 'low' && styles.priorityTextActive]}>Low</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Color Selection */}
                <View style={styles.section}>
                    <Text style={styles.label}>Color</Text>
                    <View style={styles.colorGrid}>
                        {PRESET_COLORS.map((c) => (
                            <Pressable
                                key={c}
                                style={[
                                    styles.colorOption,
                                    { backgroundColor: c },
                                    color === c && styles.colorOptionActive
                                ]}
                                onPress={() => setColor(c)}
                            />
                        ))}
                    </View>
                </View>

                {/* Reminder Section */}
                <View style={styles.section}>
                    <View style={styles.reminderHeader}>
                        <Text style={styles.label}>Reminder</Text>
                        <Switch
                            value={reminderEnabled}
                            onValueChange={setReminderEnabled}
                            trackColor={{ false: colors.border.default, true: colors.primary.main }}
                            thumbColor={colors.background.primary}
                        />
                    </View>

                    {reminderEnabled && (
                        <>
                            <View style={styles.reminderTimeRow}>
                                <Text style={styles.reminderLabel}>Time</Text>
                                <TextInput
                                    style={styles.timeInput}
                                    value={reminderTime}
                                    onChangeText={setReminderTime}
                                    placeholder="09:00"
                                    placeholderTextColor={colors.text.tertiary}
                                    maxLength={5}
                                />
                            </View>

                            <View style={styles.reminderDaysRow}>
                                <Text style={styles.reminderLabel}>Days</Text>
                                <View style={styles.daysGrid}>
                                    {DAYS.map((day, index) => (
                                        <Pressable
                                            key={index}
                                            style={[
                                                styles.dayButton,
                                                reminderDays.includes(index) && styles.dayButtonActive
                                            ]}
                                            onPress={() => toggleDay(index)}
                                        >
                                            <Text style={[
                                                styles.dayButtonText,
                                                reminderDays.includes(index) && styles.dayButtonTextActive
                                            ]}>
                                                {day}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        </>
                    )}
                </View>

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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
    },
    closeButtonText: {
        fontSize: 18,
        color: colors.text.secondary,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    saveButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.primary.main,
        borderRadius: borderRadius.md,
    },
    saveButtonText: {
        color: colors.primary.contrast,
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: spacing.md,
    },
    section: {
        marginBottom: spacing.xl,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        fontSize: 16,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    categoryOption: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        gap: spacing.sm,
    },
    categoryOptionActive: {
        backgroundColor: colors.primary.main + '10',
    },
    categoryIcon: {
        fontSize: 20,
    },
    categoryLabel: {
        fontSize: 15,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    categoryLabelActive: {
        color: colors.primary.main,
        fontWeight: '600',
    },
    frequencyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    frequencyInput: {
        width: 60,
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    frequencyText: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    frequencyToggle: {
        flexDirection: 'row',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: 4,
    },
    toggleOption: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
    },
    toggleOptionActive: {
        backgroundColor: colors.background.tertiary,
    },
    toggleText: {
        fontSize: 14,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
    toggleTextActive: {
        color: colors.text.primary,
        fontWeight: '600',
    },
    priorityRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    priorityOption: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderWidth: 2,
        borderColor: colors.border.subtle,
    },
    priorityHigh: {
        backgroundColor: '#EF444420',
        borderColor: '#EF4444',
    },
    priorityMedium: {
        backgroundColor: '#F59E0B20',
        borderColor: '#F59E0B',
    },
    priorityLow: {
        backgroundColor: '#10B98120',
        borderColor: '#10B981',
    },
    priorityText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    priorityTextActive: {
        color: colors.text.primary,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    colorOptionActive: {
        borderWidth: 3,
        borderColor: colors.background.primary,
        ...shadows.sm,
        transform: [{ scale: 1.1 }],
    },
    reminderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reminderTimeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    reminderDaysRow: {
        marginTop: spacing.md,
    },
    reminderLabel: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    timeInput: {
        backgroundColor: colors.background.tertiary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        minWidth: 80,
    },
    daysGrid: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    dayButton: {
        flex: 1,
        aspectRatio: 1,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayButtonActive: {
        backgroundColor: colors.primary.main,
    },
    dayButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.tertiary,
    },
    dayButtonTextActive: {
        color: colors.text.primary,
    },
});
