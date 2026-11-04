import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** Daily reminders scheduled on the device. They need no server, so they work offline. */
const REMINDERS = {
  workout: [
    { id: 'grit-reminder-workout', hour: 17, minute: 30, title: 'Time to move 💪', body: "Even 20 minutes counts toward today's activity goal." },
  ],
  meal: [
    { id: 'grit-reminder-lunch', hour: 12, minute: 30, title: 'Log your lunch 🥗', body: 'A quick log keeps your calories on track.' },
    { id: 'grit-reminder-dinner', hour: 19, minute: 0, title: 'Log your dinner 🍽️', body: 'Finish the day with an accurate count.' },
  ],
} as const;

const ALL_IDS = [...REMINDERS.workout, ...REMINDERS.meal].map((r) => r.id);

/** Matches the scheduled reminders to the user's preferences. Safe to call repeatedly. */
export async function syncLocalReminders(prefs: { notifWorkout: boolean; notifMeal: boolean }): Promise<void> {
  if (Platform.OS === 'web') return;

  const wanted = [
    ...(prefs.notifWorkout ? REMINDERS.workout : []),
    ...(prefs.notifMeal ? REMINDERS.meal : []),
  ];
  // Only schedule once allowed; never prompt from here
  const { granted } = await Notifications.getPermissionsAsync();

  const scheduled = new Set((await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier));
  await Promise.all(
    ALL_IDS.filter((id) => scheduled.has(id) && !(granted && wanted.some((w) => w.id === id))).map((id) =>
      Notifications.cancelScheduledNotificationAsync(id),
    ),
  );
  if (!granted) return;

  await Promise.all(
    wanted
      .filter((r) => !scheduled.has(r.id))
      .map((r) =>
        Notifications.scheduleNotificationAsync({
          identifier: r.id,
          content: { title: r.title, body: r.body, data: { type: 'reminder' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute },
        }),
      ),
  );
}

/** Asks for notification permission if it hasn't been decided yet. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    // Android 13 only shows the prompt once a channel exists
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders and alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}
