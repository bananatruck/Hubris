import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Switch,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, shadows } from '../../src/theme';
import { resetDatabase } from '../../src/db/database';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );
}

function SettingsRow({
    label,
    value,
    onPress,
    hasArrow = true,
}: {
    label: string;
    value?: string;
    onPress?: () => void;
    hasArrow?: boolean;
}) {
    return (
        <Pressable style={styles.settingsRow} onPress={onPress}>
            <Text style={styles.rowLabel}>{label}</Text>
            <View style={styles.rowRight}>
                {value && <Text style={styles.rowValue}>{value}</Text>}
                {hasArrow && <Text style={styles.arrow}>›</Text>}
            </View>
        </Pressable>
    );
}

function SettingsToggle({
    label,
    value,
    onValueChange,
}: {
    label: string;
    value: boolean;
    onValueChange?: (val: boolean) => void;
}) {
    return (
        <View style={styles.settingsRow}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: colors.background.tertiary, true: colors.primary.main }}
                thumbColor={colors.text.primary}
            />
        </View>
    );
}

export default function ProfileScreen() {
    const [darkMode, setDarkMode] = React.useState(true);
    const [notifications, setNotifications] = React.useState(true);
    const [haptics, setHaptics] = React.useState(true);

    const handleResetDatabase = () => {
        Alert.alert(
            "Reset Database",
            "Are you sure? This will delete all your data.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: async () => {
                        await resetDatabase();
                        Alert.alert("Success", "Database has been reset.");
                        router.replace('/');
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </Pressable>
                    <Text style={styles.title}>Profile 👤</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* User Stats */}
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>42</Text>
                        <Text style={styles.statLabel}>Day Streak</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>12</Text>
                        <Text style={styles.statLabel}>Activities</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>156</Text>
                        <Text style={styles.statLabel}>Total Logs</Text>
                    </View>
                </View>

                {/* Appearance */}
                <SettingsSection title="Appearance">
                    <SettingsToggle
                        label="Dark Mode"
                        value={darkMode}
                        onValueChange={setDarkMode}
                    />
                </SettingsSection>

                {/* Notifications */}
                <SettingsSection title="Notifications">
                    <SettingsToggle
                        label="Push Notifications"
                        value={notifications}
                        onValueChange={setNotifications}
                    />
                    <SettingsToggle
                        label="Haptic Feedback"
                        value={haptics}
                        onValueChange={setHaptics}
                    />
                    <SettingsRow label="Reminder Defaults" value="15 min before" />
                </SettingsSection>

                {/* Activities */}
                <SettingsSection title="Activity Management">
                    <SettingsRow label="Create New Activity" />
                    <SettingsRow label="Hidden Activities" value="2" />
                    <SettingsRow label="Archived Activities" value="0" />
                    <SettingsRow label="Pinned Quick-Log Activities" value="6" />
                </SettingsSection>

                {/* Goals */}
                <SettingsSection title="Goals">
                    <SettingsRow label="Active Goals" value="3" />
                    <SettingsRow label="Completed Goals" value="7" />
                </SettingsSection>

                {/* Data */}
                <SettingsSection title="Data">
                    <SettingsRow label="Export Data" />
                    <SettingsRow label="Import Data" />
                    <SettingsRow label="Clear All Data" onPress={handleResetDatabase} />
                </SettingsSection>

                {/* About */}
                <SettingsSection title="About">
                    <SettingsRow label="Version" value="1.0.0" hasArrow={false} />
                    <SettingsRow label="Privacy Policy" />
                    <SettingsRow label="Terms of Service" />
                </SettingsSection>

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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
    },
    backButtonText: {
        fontSize: 24,
        color: colors.text.primary,
        marginTop: -2,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        ...shadows.sm,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.primary.main,
        marginBottom: spacing.xs,
    },
    statLabel: {
        fontSize: 12,
        color: colors.text.secondary,
    },
    statDivider: {
        width: 1,
        backgroundColor: colors.border.default,
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
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    sectionContent: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    rowLabel: {
        fontSize: 16,
        color: colors.text.primary,
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    rowValue: {
        fontSize: 15,
        color: colors.text.secondary,
    },
    arrow: {
        fontSize: 20,
        color: colors.text.tertiary,
    },
});
