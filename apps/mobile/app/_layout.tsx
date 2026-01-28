import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { colors } from '../src/theme';
import { DatabaseProvider, useDatabase } from '../src/providers/DatabaseProvider';

function AppContent() {
    const { isReady, error } = useDatabase();

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>Failed to initialize database</Text>
                <Text style={styles.errorDetail}>{error.message}</Text>
            </View>
        );
    }

    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.main} />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <>
            <StatusBar style="light" />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background.primary },
                    animation: 'fade',
                }}
            >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="activity/[id]"
                    options={{
                        presentation: 'card',
                        animation: 'slide_from_right',
                    }}
                />
                <Stack.Screen
                    name="modals/quick-log"
                    options={{
                        presentation: 'transparentModal',
                        animation: 'fade',
                    }}
                />
                <Stack.Screen
                    name="modals/log"
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="modals/plan"
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="modals/goal"
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <View style={styles.container}>
            <DatabaseProvider>
                <AppContent />
            </DatabaseProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
    },
    loadingText: {
        marginTop: 16,
        color: colors.text.secondary,
        fontSize: 16,
    },
    errorText: {
        color: colors.status.error,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    errorDetail: {
        color: colors.text.secondary,
        fontSize: 14,
    },
});
