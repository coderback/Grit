/**
 * In-browser stand-in for the NestJS API, used only when EXPO_PUBLIC_DEMO_MODE=true.
 * Everything here is fictional sample data, held in memory for the current tab.
 * Reloading the page restores the starting data.
 */
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DEMO_NUDGE } from './replies';

export const DEMO_USER_ID = 'demo-user';

const dayMs = 86400000;
const dateStr = (offset = 0) => new Date(Date.now() + offset * dayMs).toISOString().split('T')[0];
const isoAt = (offset: number, hour: number) => `${dateStr(offset)}T${String(hour).padStart(2, '0')}:00:00.000Z`;

let nextId = 1000;
const newId = (prefix: string) => `${prefix}-${nextId++}`;

// Same presets, activity types and calorie estimate as packages/backend
const PRESET_HABITS: Record<string, { name: string; emoji: string }> = {
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
const FREE_TIER_HABIT_LIMIT = 5;
const ACTIVITY_TYPES = [
  'running', 'cycling', 'walking', 'swimming', 'strength_training',
  'yoga', 'hiit', 'rowing', 'elliptical', 'stair_climbing',
  'basketball', 'tennis', 'soccer', 'dancing', 'hiking',
  'jump_rope', 'pilates', 'boxing', 'rock_climbing', 'other',
];
const MET: Record<string, number> = {
  running: 9.8, cycling: 7.5, walking: 3.5, swimming: 8.0,
  strength_training: 5.0, yoga: 2.5, hiit: 8.0, rowing: 7.0,
  elliptical: 5.0, stair_climbing: 8.0, basketball: 6.5, tennis: 7.0,
  soccer: 7.0, dancing: 4.5, hiking: 6.0, jump_rope: 11.0,
  pilates: 3.0, boxing: 7.8, rock_climbing: 8.0, other: 5.0,
};

const person = (id: string, displayName: string, username: string) => ({ id, displayName, username, avatarUrl: null });
const riley = person('u-riley', 'Riley Demo', 'riley_demo');
const morgan = person('u-morgan', 'Morgan Demo', 'morgan_demo');
const casey = person('u-casey', 'Casey Demo', 'casey_demo');
const me = person(DEMO_USER_ID, 'Alex Demo', 'alex_demo');
const people = [me, riley, morgan, casey];

const user = {
  ...me,
  calorieGoal: 2250,
  weightKg: 78,
  primaryGoal: 'build_muscle',
  heightCm: 178,
  activityLevel: 'moderate',
  gender: 'other',
};

const food = (name: string, brand: string | null, calories: number, proteinG: number, carbsG: number, fatG: number, servingUnit: string, barcode: string | null = null) => ({
  offId: `sample-${name.toLowerCase().replace(/\W+/g, '-')}`,
  name, brand, barcode, calories, proteinG, carbsG, fatG, servingQty: 1, servingUnit, imageUrl: null,
});
export const SAMPLE_FOODS = [
  food('Porridge oats with milk', null, 310, 13, 48, 8, 'bowl'),
  food('Greek yoghurt', 'Sample Dairy', 130, 15, 6, 5, '150 g pot', '0000000000017'),
  food('Chicken breast', null, 165, 31, 0, 4, '100 g'),
  food('Brown rice', null, 215, 5, 45, 2, 'cup'),
  food('Banana', null, 105, 1, 27, 0, 'medium'),
  food('Protein shake', 'Sample Nutrition', 180, 25, 8, 4, '330 ml bottle', '0000000000024'),
  food('Salmon fillet', null, 280, 28, 0, 18, '130 g'),
  food('Peanut butter on toast', null, 290, 11, 28, 15, '2 slices'),
  food('Mixed salad', null, 60, 2, 9, 2, 'bowl'),
  food('Oat granola bar', 'Sample Snacks', 190, 4, 27, 7, 'bar', '0000000000031'),
];

interface Log { id: string; name: string; brand: string | null; barcode: string | null; mealType: string; calories: number; proteinG: number; carbsG: number; fatG: number; servingQty: number; servingUnit: string; loggedAt: string }
const log = (id: string, f: (typeof SAMPLE_FOODS)[number], mealType: string, offset: number, hour: number): Log => ({
  id, name: f.name, brand: f.brand, barcode: f.barcode, mealType, calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, servingQty: 1, servingUnit: f.servingUnit, loggedAt: isoAt(offset, hour),
});
const foodLogs: Log[] = [
  log('f1', SAMPLE_FOODS[0], 'breakfast', 0, 7),
  log('f2', SAMPLE_FOODS[4], 'breakfast', 0, 7),
  log('f3', SAMPLE_FOODS[2], 'lunch', 0, 12),
  log('f4', SAMPLE_FOODS[3], 'lunch', 0, 12),
  log('f5', SAMPLE_FOODS[1], 'snack', 0, 15),
];

interface Activity { id: string; activityType: string; durationMin: number; caloriesBurned: number | null; steps: number | null; source: string; loggedAt: string; kudosCount: number }
const activity = (id: string, activityType: string, durationMin: number, offset: number, steps: number | null = null): Activity => ({
  id, activityType, durationMin, steps, source: 'manual', loggedAt: isoAt(offset, 8), kudosCount: 0,
  caloriesBurned: Math.round((MET[activityType] ?? 5) * user.weightKg * (durationMin / 60)),
});
const activityLogs: Activity[] = [
  activity('a1', 'strength_training', 50, 0),
  activity('a2', 'running', 30, -1, 4200),
  activity('a3', 'walking', 40, -2, 5100),
  activity('a4', 'cycling', 45, -3),
  activity('a5', 'yoga', 25, -5),
];

interface Habit { id: string; name: string; emoji: string; isPreset: boolean; presetKey: string | null; isActive: boolean; createdAt: string }
const habit = (id: string, presetKey: string): Habit => ({
  id, presetKey, isPreset: true, isActive: true, createdAt: isoAt(-40, 9), ...PRESET_HABITS[presetKey],
});
const habits: Habit[] = [habit('h1', 'water'), habit('h2', 'sleep'), habit('h3', 'stretch')];
// Dates completed per habit. The patterns give each habit a different streak.
const habitDone: Record<string, Set<string>> = {
  h1: new Set(Array.from({ length: 12 }, (_, i) => dateStr(-i - 1))),
  h2: new Set([0, 1, 2, 3, 5, 6, 8, 9, 10, 13, 15].map((i) => dateStr(-i))),
  h3: new Set([1, 2, 4, 7, 9, 12, 14, 19].map((i) => dateStr(-i))),
};

/** Same rule as HabitsService: one missed day is allowed if the 6 days before it were complete. */
function streakOf(done: Set<string>) {
  let count = 0;
  let i = done.has(dateStr(0)) ? 0 : 1;
  for (let guard = 0; guard < 60; guard += 1) {
    if (done.has(dateStr(-i))) { count += 1; i += 1; continue; }
    const graced = [1, 2, 3, 4, 5, 6].every((b) => done.has(dateStr(-i - b)));
    if (!graced) break;
    i += 1;
  }
  return count;
}

const feed = [
  { id: 'fd1', type: 'activity_log', loggedAt: isoAt(0, 9), user: riley, data: { id: 'x1', activityType: 'running', durationMin: 42, caloriesBurned: 512, steps: 6800, kudosCount: 3 } },
  { id: 'fd2', type: 'food_log', loggedAt: isoAt(0, 8), user: morgan, data: { name: 'Porridge oats with milk', mealType: 'breakfast', calories: 310 } },
  { id: 'fd3', type: 'habit_log', loggedAt: isoAt(0, 7), user: casey, data: { habitName: 'Meditate 10 min', habitEmoji: '🧘' } },
  { id: 'fd4', type: 'activity_log', loggedAt: isoAt(-1, 18), user: morgan, data: { id: 'x2', activityType: 'hiit', durationMin: 25, caloriesBurned: 260, kudosCount: 5 } },
  { id: 'fd5', type: 'habit_log', loggedAt: isoAt(-1, 7), user: riley, data: { habitName: 'Sleep 7+ hours', habitEmoji: '😴' } },
];

const following = new Set(['u-riley', 'u-morgan']);

const participant = (id: string, u: typeof me, currentValue: number) => ({ id, userId: u.id, currentValue, user: u });
const challenge = (id: string, title: string, goalValue: number, durationDays: number, daysIn: number, inviteCode: string, participants: ReturnType<typeof participant>[]) => ({
  id, title, type: 'steps', goalValue, durationDays, inviteCode, isComplete: false, participants,
  // Fields the challenge cards on the Social tab read
  description: `${goalValue.toLocaleString()} steps as a group`, participantCount: participants.length, progress: daysIn, total: durationDays,
  startDate: isoAt(-daysIn, 0), endDate: isoAt(durationDays - daysIn, 0), createdAt: isoAt(-daysIn, 0),
});
const challenges = [
  challenge('c1', '100k Steps Together', 100000, 7, 4, 'DEMO100', [
    participant('p1', riley, 28400), participant('p2', me, 21750), participant('p3', morgan, 17300),
  ]),
  challenge('c2', 'Weekend Walkers', 40000, 3, 1, 'DEMOWALK', [
    participant('p4', casey, 9100), participant('p5', me, 7200),
  ]),
];

function reject(status: number, message: string): never {
  const err = new Error(message) as Error & { response: { status: number; data: { message: string } } };
  err.response = { status, data: { message } };
  throw err;
}

function route(method: string, url: string, body: any): unknown {
  const [path, queryString] = url.split('?');
  const query = new URLSearchParams(queryString ?? '');
  const parts = path.split('/').filter(Boolean);
  const key = `${method} /${parts.join('/')}`;

  if (key === 'POST /auth/sync' || key === 'POST /notifications/register') return { ok: true };
  if (key === 'GET /users/me') return user;
  if (key === 'PUT /users/me') {
    Object.assign(user, body);
    me.displayName = user.displayName;
    return user;
  }
  if (key === 'GET /users/me/following') {
    return people.filter((p) => following.has(p.id)).map((p) => ({ following: p }));
  }
  if (method === 'GET' && parts[0] === 'users' && parts[2] === 'profile') {
    const p = people.find((x) => x.id === parts[1]) ?? reject(404, 'User not found');
    return {
      ...p, primaryGoal: p.id === DEMO_USER_ID ? user.primaryGoal : 'just_track', createdAt: isoAt(-90, 9),
      _count: { following: p.id === DEMO_USER_ID ? following.size : 2, followers: 3 },
    };
  }
  if (parts[0] === 'follow') {
    if (method === 'POST') following.add(parts[1]); else following.delete(parts[1]);
    return { ok: true };
  }

  if (key === 'GET /food-logs') {
    const logs = foodLogs.filter((l) => l.loggedAt.startsWith(query.get('date') ?? dateStr()));
    const sum = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') => logs.reduce((s, l) => s + l[k], 0);
    return { logs, totals: { calories: sum('calories'), proteinG: sum('proteinG'), carbsG: sum('carbsG'), fatG: sum('fatG') } };
  }
  if (key === 'POST /food-logs') {
    const entry: Log = {
      id: newId('f'), brand: null, barcode: null, proteinG: 0, carbsG: 0, fatG: 0, servingQty: 1, servingUnit: 'serving', ...body, loggedAt: new Date().toISOString(),
    };
    foodLogs.push(entry);
    return entry;
  }
  if (method === 'DELETE' && parts[0] === 'food-logs') {
    const i = foodLogs.findIndex((l) => l.id === parts[1]);
    if (i >= 0) foodLogs.splice(i, 1);
    return { ok: true };
  }
  if (key === 'GET /food/search') {
    const q = (query.get('q') ?? '').toLowerCase();
    return SAMPLE_FOODS.filter((f) => f.name.toLowerCase().includes(q) || (f.brand ?? '').toLowerCase().includes(q));
  }
  if (method === 'GET' && parts[0] === 'food' && parts[1] === 'barcode') {
    return SAMPLE_FOODS.find((f) => f.barcode === parts[2]) ?? reject(404, 'Product not found');
  }

  if (key === 'GET /habits') return habits;
  if (key === 'GET /habits/presets') return Object.entries(PRESET_HABITS).map(([k, v]) => ({ key: k, ...v }));
  if (key === 'POST /habits') {
    if (habits.length >= FREE_TIER_HABIT_LIMIT) reject(403, `Free tier allows up to ${FREE_TIER_HABIT_LIMIT} habits`);
    const preset = body.presetKey ? PRESET_HABITS[body.presetKey] : null;
    const created: Habit = {
      id: newId('h'), name: preset?.name ?? body.name, emoji: preset?.emoji ?? body.emoji ?? '✅', isPreset: !!preset, presetKey: body.presetKey ?? null, isActive: true, createdAt: new Date().toISOString(),
    };
    habits.push(created);
    habitDone[created.id] = new Set();
    return created;
  }
  if (parts[0] === 'habits' && parts[2] === 'streak') {
    const h = habits.find((x) => x.id === parts[1]) ?? reject(404, 'Habit not found');
    const done = habitDone[h.id];
    return {
      habit: h,
      streakCount: streakOf(done),
      grid: Array.from({ length: 30 }, (_, i) => ({ date: dateStr(i - 29), completed: done.has(dateStr(i - 29)) })),
    };
  }
  if (method === 'POST' && parts[0] === 'habits' && parts[2] === 'log') {
    habitDone[parts[1]]?.add(dateStr());
    return { ok: true };
  }
  if (method === 'DELETE' && parts[0] === 'habits') {
    const i = habits.findIndex((x) => x.id === parts[1]);
    if (i >= 0) habits.splice(i, 1);
    return { ok: true };
  }

  if (key === 'GET /activity-logs/types') return ACTIVITY_TYPES;
  if (key === 'GET /activity-logs') {
    return activityLogs.filter((a) => a.loggedAt.startsWith(query.get('date') ?? dateStr()));
  }
  if (key === 'GET /activity-logs/week') {
    const now = new Date();
    const mondayOffset = -((now.getUTCDay() + 6) % 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = dateStr(mondayOffset + i);
      const logs = activityLogs.filter((a) => a.loggedAt.startsWith(date));
      return {
        date,
        activeMinutes: logs.reduce((s, a) => s + a.durationMin, 0),
        caloriesBurned: logs.reduce((s, a) => s + (a.caloriesBurned ?? 0), 0),
        steps: logs.reduce((s, a) => s + (a.steps ?? 0), 0),
      };
    });
    return {
      weekStart: days[0].date,
      weekEnd: days[6].date,
      days,
      totals: {
        activeMinutes: days.reduce((s, d) => s + d.activeMinutes, 0),
        caloriesBurned: days.reduce((s, d) => s + d.caloriesBurned, 0),
        steps: days.reduce((s, d) => s + d.steps, 0),
      },
    };
  }
  if (key === 'POST /activity-logs') {
    const entry: Activity = {
      id: newId('a'), steps: null, source: 'manual', kudosCount: 0, loggedAt: new Date().toISOString(),
      caloriesBurned: Math.round((MET[body.activityType] ?? 5) * user.weightKg * (body.durationMin / 60)),
      ...body,
    };
    activityLogs.push(entry);
    return entry;
  }
  if (method === 'POST' && parts[0] === 'activity-logs' && parts[2] === 'kudos') return { ok: true };

  if (key === 'GET /feed') return feed;
  if (key === 'GET /leaderboard/weekly') {
    const myWeek = activityLogs.filter((a) => a.loggedAt >= isoAt(-7, 0));
    const entries = [
      { user: riley, activeMinutes: 214, steps: 41200, isMe: false },
      { user: morgan, activeMinutes: 96, steps: 18900, isMe: false },
      { user: me, activeMinutes: myWeek.reduce((s, a) => s + a.durationMin, 0), steps: myWeek.reduce((s, a) => s + (a.steps ?? 0), 0), isMe: true },
    ];
    return entries.sort((a, b) => b.activeMinutes - a.activeMinutes);
  }

  if (key === 'GET /challenges') return challenges;
  if (key === 'POST /challenges') {
    const created = challenge(newId('c'), body.title, body.goalValue, body.durationDays, 0, `DEMO${nextId}`, [participant(newId('p'), me, 0)]);
    challenges.unshift(created);
    return created;
  }
  if (method === 'POST' && parts[0] === 'challenges' && parts[1] === 'join') {
    return challenges.find((c) => c.inviteCode === parts[2]) ?? reject(404, 'Invite code not found');
  }
  if (method === 'GET' && parts[0] === 'challenges') {
    const c = challenges.find((x) => x.id === parts[1]) ?? reject(404, 'Challenge not found');
    return { ...c, totalProgress: c.participants.reduce((s, p) => s + p.currentValue, 0) };
  }
  if (method === 'PUT' && parts[0] === 'challenges' && parts[2] === 'progress') {
    const c = challenges.find((x) => x.id === parts[1]) ?? reject(404, 'Challenge not found');
    const mine = c.participants.find((p) => p.userId === DEMO_USER_ID);
    if (mine) mine.currentValue += Number(body.steps) || 0;
    c.participants.sort((a, b) => b.currentValue - a.currentValue);
    c.isComplete = c.participants.reduce((s, p) => s + p.currentValue, 0) >= c.goalValue;
    return c;
  }

  if (key === 'GET /ai/messages') return [];
  if (key === 'GET /ai/nudge') return { nudge: DEMO_NUDGE };

  return reject(404, `No demo data for ${key}`);
}

export const demoAdapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
  const method = (config.method ?? 'get').toUpperCase();
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  const data = route(method, config.url ?? '/', body);
  return {
    data, status: 200, statusText: 'OK', headers: {}, config,
  } as AxiosResponse;
};
