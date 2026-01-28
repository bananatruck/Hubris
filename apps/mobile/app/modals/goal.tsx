import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '../../src/theme';

export default function GoalModal() {
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [selectedActivity, _setSelectedActivity] = React.useState('');
    const [targetDate, _setTargetDate] = React.useState('');
    const [targetValue, setTargetValue] = React.useState('');

    const handleSave = () => {
        console.log('Saving goal:', { title, description, selectedActivity, targetDate, targetValue });
        router.back();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.cancelButton}>Cancel</Text>
                </Pressable>
                <Text style={styles.title}>New Goal</Text>
                <Pressable onPress={handleSave}>
                    <Text style={styles.saveButton}>Save</Text>
                </Pressable>
            </View>

            <ScrollView style={styles.content}>
                {/* Goal Title */}
                <View style={styles.field}>
                    <Text style={styles.label}>Goal Title</Text>
                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="e.g., Complete 100 LeetCode problems"
                        placeholderTextColor={colors.text.tertiary}
                    />
                </View>

                {/* Description */}
                <View style={styles.field}>
                    <Text style={styles.label}>Description (optional)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Add more details about your goal..."
                        placeholderTextColor={colors.text.tertiary}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Link to Activity */}
                <View style={styles.field}>
                    <Text style={styles.label}>Link to Activity (optional)</Text>
                    <Pressable style={styles.selector}>
                        <Text style={[styles.selectorText, !selectedActivity && styles.selectorPlaceholder]}>
                            {selectedActivity || 'Select an activity'}
                        </Text>
                        <Text style={styles.selectorArrow}>›</Text>
                    </Pressable>
                </View>

                {/* Target Date */}
                <View style={styles.field}>
                    <Text style={styles.label}>Target Date (optional)</Text>
                    <Pressable style={styles.selector}>
                        <Text style={[styles.selectorText, !targetDate && styles.selectorPlaceholder]}>
                            {targetDate || 'Set a deadline'}
                        </Text>
                        <Text style={styles.selectorArrow}>›</Text>
                    </Pressable>
                </View>

                {/* Target Value */}
                <View style={styles.field}>
                    <Text style={styles.label}>Target Value (optional)</Text>
                    <TextInput
                        style={styles.input}
                        value={targetValue}
                        onChangeText={setTargetValue}
                        placeholder="e.g., 100"
                        placeholderTextColor={colors.text.tertiary}
                        keyboardType="number-pad"
                    />
                    <Text style={styles.hint}>A measurable target to track progress</Text>
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
    input: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text.primary,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    selectorText: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
    },
    selectorPlaceholder: {
        color: colors.text.tertiary,
    },
    selectorArrow: {
        fontSize: 20,
        color: colors.text.tertiary,
    },
    hint: {
        fontSize: 13,
        color: colors.text.tertiary,
        marginTop: spacing.xs,
    },
});
