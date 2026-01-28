import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../src/theme';
import { useActivity } from '../../src/hooks/useActivities';
import { createLogEntry } from '../../src/hooks/useLogEntries';

export default function LogModal() {
    const params = useLocalSearchParams();
    const activityId = params.activityId as string;

    const { activity, loading: activityLoading } = useActivity(activityId);
    const [logging, setLogging] = useState(false);

    const [value, setValue] = useState('');
    const [note, setNote] = useState('');
    const [thoughts, setThoughts] = useState('');

    const handleSave = async () => {
        if (!activityId) return;

        try {
            setLogging(true);
            await createLogEntry(activityId, value || null, note || null, thoughts || null);
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to save log');
        } finally {
            setLogging(false);
        }
    };

    if (activityLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator color={colors.primary.main} />
            </View>
        );
    }

    if (!activity) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={{ color: colors.text.secondary }}>Activity not found</Text>
                <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
                    <Text style={{ color: colors.primary.main }}>Go Back</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.cancelButton}>Cancel</Text>
                </Pressable>
                <Text style={styles.title}>Log Activity</Text>
                <Pressable onPress={handleSave} disabled={logging}>
                    <Text style={[styles.saveButton, logging && { opacity: 0.5 }]}>
                        {logging ? 'Saving...' : 'Save'}
                    </Text>
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Activity Info */}
                <View style={styles.activityHeader}>
                    {activity.image_url ? (
                        <Image source={{ uri: activity.image_url }} style={styles.activityImage} />
                    ) : (
                        <View style={[styles.activityIcon, { backgroundColor: activity.color }]}>
                            <Text style={styles.activityInitial}>{activity.name[0]}</Text>
                        </View>
                    )}
                    <View>
                        <Text style={styles.activityName}>{activity.name}</Text>
                        <Text style={styles.activityCategory}>{activity.category}</Text>
                    </View>
                </View>

                {/* Value Input (template-based) */}
                <View style={styles.field}>
                    <Text style={styles.label}>Value (Optional)</Text>
                    <View style={styles.counterRow}>
                        <Pressable
                            style={styles.counterButton}
                            onPress={() => {
                                const current = parseInt(value) || 0;
                                setValue(String(Math.max(0, current - 1)));
                            }}
                        >
                            <Text style={styles.counterButtonText}>−</Text>
                        </Pressable>
                        <TextInput
                            style={styles.counterInput}
                            value={value}
                            onChangeText={setValue}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={colors.text.tertiary}
                        />
                        <Pressable
                            style={styles.counterButton}
                            onPress={() => {
                                const current = parseInt(value) || 0;
                                setValue(String(current + 1));
                            }}
                        >
                            <Text style={styles.counterButtonText}>+</Text>
                        </Pressable>
                    </View>
                    <View style={styles.quickValues}>
                        {[1, 2, 3, 5, 10].map((num) => (
                            <Pressable
                                key={num}
                                style={styles.quickValueButton}
                                onPress={() => setValue(String(num))}
                            >
                                <Text style={styles.quickValueText}>{num}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Note */}
                <View style={styles.field}>
                    <Text style={styles.label}>Quick Note</Text>
                    <TextInput
                        style={styles.noteInput}
                        value={note}
                        onChangeText={setNote}
                        placeholder="Add a quick note..."
                        placeholderTextColor={colors.text.tertiary}
                    />
                </View>

                {/* Thoughts (Blog-like) */}
                <View style={styles.field}>
                    <Text style={styles.label}>Thoughts & Reflections</Text>
                    <TextInput
                        style={styles.thoughtsInput}
                        value={thoughts}
                        onChangeText={setThoughts}
                        placeholder="Write your thoughts here..."
                        placeholderTextColor={colors.text.tertiary}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                {/* Timestamp */}
                <View style={styles.field}>
                    <Text style={styles.label}>Logged At</Text>
                    <View style={styles.timestampBox}>
                        <Text style={styles.timestampText}>
                            {new Date().toLocaleString()}
                        </Text>
                    </View>
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
    center: {
        alignItems: 'center',
        justifyContent: 'center',
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
    activityHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    activityImage: {
        width: 50,
        height: 50,
        borderRadius: borderRadius.md,
        marginRight: spacing.md,
    },
    activityIcon: {
        width: 50,
        height: 50,
        borderRadius: borderRadius.md,
        marginRight: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityInitial: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
    },
    activityName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    activityCategory: {
        fontSize: 14,
        color: colors.text.secondary,
        textTransform: 'capitalize',
    },
    field: {
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
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    counterButton: {
        width: 50,
        height: 50,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    counterButtonText: {
        fontSize: 24,
        color: colors.primary.main,
        fontWeight: '600',
    },
    counterInput: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: 32,
        fontWeight: '700',
        color: colors.text.primary,
        textAlign: 'center',
    },
    quickValues: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    quickValueButton: {
        backgroundColor: colors.background.tertiary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
    },
    quickValueText: {
        fontSize: 14,
        color: colors.text.secondary,
        fontWeight: '600',
    },
    noteInput: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text.primary,
    },
    thoughtsInput: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text.primary,
        minHeight: 150,
        textAlignVertical: 'top', // Fix for Android
    },
    timestampBox: {
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    timestampText: {
        fontSize: 16,
        color: colors.text.primary,
    },
});
