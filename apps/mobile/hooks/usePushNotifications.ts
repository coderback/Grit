import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { notificationRoute } from '@/lib/notificationRoute';

// The token this phone registered, so sign-out can remove it
let registeredToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  // Expo push tokens are only issued to iOS and Android builds
  if (Platform.OS === 'web') return null;

  // Android 8+ shows nothing without a channel, and Android 13 only offers the
  // permission prompt once one exists
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders and alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Permission is asked for in onboarding and in Settings, where the user
  // chooses to get notifications; here we only register if it was granted
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    registerForPushNotifications()
      .then(async (token) => {
        if (!token) return;
        await api.post('/notifications/register', {
          token,
          platform: Platform.OS,
        });
        registeredToken = token;
      })
      .catch(() => {
        // Non-critical — push notifications are optional
      });
  }, [enabled]);

  // Tapping an alert opens what it's about; arriving ones refresh the inbox badge
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    function open(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data ?? {};
      // Local reminders carry their own type and just open the app
      if (data.type === 'habit_reminder' || data.type === 'reminder') return;
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      router.push(notificationRoute(data.type as string | undefined, data));
    }
    // The app was opened by tapping one
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          open(response);
          Notifications.clearLastNotificationResponseAsync?.();
        }
      })
      .catch(() => {});
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => {
      tapped.remove();
      received.remove();
    };
  }, [enabled]);
}

/** Stops this phone getting the signed-in account's alerts. Call before signing out. */
export async function unregisterPushDevice() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api.delete('/notifications/register', { data: { token } });
}

/** Schedule a local reminder at 8pm today if not already scheduled */
export async function scheduleHabitReminder() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const alreadyScheduled = existing.some((n) => n.content.data?.type === 'habit_reminder');
  if (alreadyScheduled) return;

  const trigger = new Date();
  trigger.setHours(20, 0, 0, 0);
  if (trigger <= new Date()) return; // already past 8pm

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Habit check-in time 💪',
      body: "Don't break your streak — log today's habits.",
      data: { type: 'habit_reminder' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}
