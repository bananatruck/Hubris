// ============================================
// Hubris - Notification Service
// ============================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface ReminderSettings {
    enabled: boolean;
    time: string; // HH:mm format
    days: number[]; // 0-6 (Sunday-Saturday)
}

export async function requestNotificationPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
    }

    // Configure for Android
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
            name: 'Activity Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#6366F1',
        });
    }

    return true;
}

export async function scheduleActivityReminder(
    activityId: string,
    activityName: string,
    time: string, // "HH:mm"
    days: number[] // [0, 1, 2, 3, 4, 5, 6] for each day of week
): Promise<string[]> {
    // Cancel any existing notifications for this activity
    await cancelActivityReminders(activityId);

    const [hours, minutes] = time.split(':').map(Number);
    const notificationIds: string[] = [];

    // Schedule a notification for each selected day
    for (const weekday of days) {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: `Time for ${activityName}! 💪`,
                body: `Don't forget to log your ${activityName} activity today.`,
                data: { activityId },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: weekday + 1, // Expo uses 1-7, we use 0-6
                hour: hours,
                minute: minutes,
            },
        });
        notificationIds.push(id);
    }

    return notificationIds;
}

export async function cancelActivityReminders(activityId: string): Promise<void> {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduledNotifications) {
        if (notification.content.data?.activityId === activityId) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }
}

export async function cancelAllReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

// Quick reminder - schedules a one-time notification
export async function scheduleQuickReminder(
    activityName: string,
    minutesFromNow: number
): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: `Reminder: ${activityName}`,
            body: 'Time to get started!',
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: minutesFromNow * 60,
        },
    });
    return id;
}
