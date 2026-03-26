import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

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
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export function usePushNotifications() {
  useEffect(() => {
    registerForPushNotifications()
      .then(async (token) => {
        if (!token) return;
        await api.post('/notifications/register', {
          token,
          platform: Platform.OS,
        });
      })
      .catch(() => {
        // Non-critical — push notifications are optional
      });
  }, []);
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
