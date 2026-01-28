import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { colors, borderRadius } from '../../src/theme';

// Simple icon components (will be replaced with proper icons later)
function HomeIcon({ focused }: { focused: boolean }) {
    return (
        <View style={[styles.iconContainer, focused && styles.iconFocused]}>
            <Text style={styles.iconText}>🏠</Text>
        </View>
    );
}

function CareerIcon({ focused }: { focused: boolean }) {
    return (
        <View style={[styles.iconContainer, focused && styles.iconFocused]}>
            <Text style={styles.iconText}>💼</Text>
        </View>
    );
}

function EntertainmentIcon({ focused }: { focused: boolean }) {
    return (
        <View style={[styles.iconContainer, focused && styles.iconFocused]}>
            <Text style={styles.iconText}>🎬</Text>
        </View>
    );
}

function HobbiesIcon({ focused }: { focused: boolean }) {
    return (
        <View style={[styles.iconContainer, focused && styles.iconFocused]}>
            <Text style={styles.iconText}>🎨</Text>
        </View>
    );
}

function HealthIcon({ focused }: { focused: boolean }) {
    return (
        <View style={[styles.iconContainer, focused && styles.iconFocused]}>
            <Text style={styles.iconText}>❤️</Text>
        </View>
    );
}

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: colors.primary.main,
                tabBarInactiveTintColor: colors.text.tertiary,
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarShowLabel: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="career"
                options={{
                    title: 'Career',
                    tabBarIcon: ({ focused }) => <CareerIcon focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="health"
                options={{
                    title: 'Health',
                    tabBarIcon: ({ focused }) => <HealthIcon focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="hobbies"
                options={{
                    title: 'Hobbies',
                    tabBarIcon: ({ focused }) => <HobbiesIcon focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="entertainment"
                options={{
                    title: 'Entertainment',
                    tabBarIcon: ({ focused }) => <EntertainmentIcon focused={focused} />,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: colors.background.secondary,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
        height: 80,
        paddingBottom: 20,
        paddingTop: 10,
    },
    tabBarLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    iconContainer: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.lg,
    },
    iconFocused: {
        backgroundColor: colors.primary.main + '20',
    },
    iconText: {
        fontSize: 22,
    },
});
