export const PRESET_HABITS: Record<string, { name: string; emoji: string }> = {
  water: { name: 'Drink 8 glasses of water', emoji: '💧' },
  sleep: { name: 'Sleep 7+ hours', emoji: '😴' },
  meditate: { name: 'Meditate 10 min', emoji: '🧘' },
  no_alcohol: { name: 'No alcohol', emoji: '🚫' },
  read: { name: 'Read 20 min', emoji: '📚' },
  walk_outside: { name: 'Walk outside', emoji: '🌳' },
  stretch: { name: 'Stretch / mobility', emoji: '🤸' },
  cold_shower: { name: 'Cold shower', emoji: '🚿' },
  journal: { name: 'Journaling', emoji: '📝' },
  screen_free: { name: 'Screen-free morning', emoji: '🌅' },
};

// A sanity limit to keep the habit list and streak queries bounded
export const MAX_ACTIVE_HABITS = 20;

// Check-ins can be added or removed this many days back (the streak grid's span)
export const BACKFILL_DAYS = 30;
