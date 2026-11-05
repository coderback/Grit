# GRIT

A full-stack fitness and nutrition tracking app for people serious about body composition. GRIT combines macro tracking, habit building, activity logging, social challenges, and an AI coach into a single opinionated mobile experience, in dark or light.

---

## What's Inside

```
grit/
├── apps/
│   └── mobile/          # Expo (React Native) app
└── packages/
    └── backend/         # NestJS REST API
```

---

## Mobile App

**Stack:** Expo SDK 54 · React Native 0.81 · Expo Router · NativeWind · Zustand · TanStack Query · Supabase Auth

**Screens**

| Route | Description |
|---|---|
| `/onboarding` | 11-step personalisation flow (no auth required) |
| `/onboarding/basics` | Gender |
| `/onboarding/age` | Age (scroll picker) |
| `/onboarding/body` | Height + weight |
| `/onboarding/activity` | Activity level selection |
| `/onboarding/goal` | Primary goal + desired weight |
| `/onboarding/pace` | Pace selection with live calorie preview |
| `/onboarding/friction` | Biggest obstacle (used for AI coach context) |
| `/onboarding/nutrition` | Diet type, goal focus, aim |
| `/onboarding/advanced` | Earnback calories toggle, rollover toggle |
| `/onboarding/notifications` | Notification preferences |
| `/onboarding/reveal` | Personalised TDEE + macro plan reveal |
| `/onboarding/signup` | Account creation (email + password, or Google / Apple) |
| `/(auth)/login` | Returning user login (email, Google or Apple) |
| `/(tabs)/` | Home — daily calorie budget, macro progress, today's workout |
| `/(tabs)/food` | Food log — any day, meal sections, edit entries, barcode scanner, ✨ Smart log (describe or photograph a meal) |
| `/(tabs)/habits` | Habit tracker — check-ins, undo, 30-day history and back-fill |
| `/(tabs)/activity` | Stats — adaptive calorie target, 7D/30D/3M trends for calories, protein, activity and weight, then any week's workouts |
| `/(tabs)/social` | Feed, challenges and leaderboard |
| `/(tabs)/profile` | User profile + settings |
| `/settings/goals` | Goals & Targets — goal, body stats, calories, macros, earnback/rollover |
| `/settings/notifications` | Daily reminders and alert preferences |
| `/settings/account` | Appearance (system, light, dark), units, password reset, log out, delete account |
| `/settings/privacy` | Private account and blocked people |
| `/settings/health` | Apple Health / Health Connect: connect, sync now, what was imported |
| `/settings/foods` | Foods GRIT knows: portions learned from Smart log |
| `/settings/coach-memory` | What your coach knows: notes from chats, add or delete |
| `/auth-callback` | Finishes Google or Apple sign-in |
| `/plan` | Weekly workout plan built by the coach |
| `/friends` | Search people, follow requests, followers and following |
| `/profile/[id]` | Someone's profile: follow state, this week's stats and recent activity (if allowed) |
| `/connections` | A user's followers or following |
| `/notifications` | Inbox of follows, requests, kudos, challenge results and progress alerts |
| `/reset-password` | Opened from the password reset email |
| `/coach` | AI coach chat (GPT-6 Luna via Azure AI Foundry) |
| `/barcode-scanner` | Camera barcode scanner (full-screen modal) |

**Auth flow:** New users complete all 11 onboarding screens before any account is created. The personalised plan is revealed first, then sign-up. Returning users land directly at login.

### Run

All commands below run from the **repo root** unless noted.

```bash
# Install
npm install

# Start Expo dev server — run from repo root
npm run mobile

# iOS simulator
cd apps/mobile && npx expo start --ios

# Android emulator
cd apps/mobile && npx expo start --android
```

### Environment

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

See [`apps/mobile/.env.example`](./apps/mobile/.env.example) for each variable. `EXPO_PUBLIC_API_URL` must point at a backend reachable from the device (not `localhost` on Android or a physical phone).

EAS builds don't read `.env`: they use the project's EAS environment variables (expo.dev → project → Environment variables). Each build profile in `eas.json` names its environment (`development`, `preview` or `production`), so set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in each. Store builds need an `https://` API URL.

### Build APK (for device testing)

```bash
cd apps/mobile
eas build --platform android --profile preview
```

The `preview` profile outputs a plain `.apk` (~10–15 min cloud build via EAS).

---

## Backend

**Stack:** NestJS 11 · Prisma 5 · PostgreSQL (Supabase) · Supabase Auth (JWT verification) · Upstash Redis · OpenAI SDK (GPT-6 Luna on Azure AI Foundry)

**Modules**

| Module | Routes |
|---|---|
| `auth` | Guard that verifies Supabase access tokens, `POST /auth/sync` |
| `users` | `GET/PUT/DELETE /users/me` (delete removes the account and its Supabase sign-in) |
| `food` | `GET/POST /food-logs` (with the day's calorie budget and macro targets), `GET /food-logs/week?date=`, `PATCH/DELETE /food-logs/:id`, Open Food Facts search + barcode proxy, `GET /food/recent`, `GET/POST /food/favorites`, `DELETE /food/favorites/:id` |
| `meal-parse` | `POST /food/parse` (text and/or photo → items), `POST /food/parse/log`, `GET /food/memories`, `DELETE /food/memories/:id` |
| `health` | `POST /health/import` (workouts, daily steps and sleep, weigh-ins from Apple Health / Health Connect), `GET /health/recent` |
| `activity` | `GET/POST /activity-logs`, `GET /activity-logs/week?date=`, `PATCH/DELETE /activity-logs/:id`, `POST /activity-logs/:id/kudos` |
| `habits` | `GET/POST/PUT/DELETE /habits`, `POST/DELETE /habits/:id/log?date=`, `GET /habits/streaks`, `GET /habits/:id/streak` |
| `workout-plan` | `GET /workout-plan`, `POST /workout-plan/generate`, `PUT /workout-plan/days/:day` |
| `challenges` | `GET/POST /challenges` (steps, active minutes or workouts; progress from logged workouts), `GET/DELETE /challenges/:id`, `POST /challenges/join/:code`, `DELETE /challenges/:id/participants/me` |
| `social` | `GET /feed`, `GET /leaderboard/weekly`, `GET /search/users?q=`, `POST/DELETE /follow/:userId`, `GET /follow-requests`, `POST /follow-requests/:userId/accept`, `DELETE /follow-requests/:userId`, `DELETE /followers/:userId`, `GET /users/:id/{profile,followers,following}`, `GET/POST/DELETE /blocks` |
| `progress` | `GET/POST /weight`, `DELETE /weight/:id`, `GET /stats/trends?days=7\|30\|90`, `GET /targets/adaptive`, `POST /targets/adaptive/apply`, `POST /targets/adaptive/snooze` |
| `ai` | `POST /ai/message` (streamed), `GET /ai/messages`, `GET /ai/nudge`, `GET/POST/DELETE /ai/memories`, `DELETE /ai/memories/:id` — AI coach and its notes |
| `notifications` | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read`, `POST/DELETE /notifications/register` (one row per phone), Expo push sending |
| `app` | `GET /health`, `POST /client-errors` (crash reports from the app, no sign-in, throttled) |
| `alerts` | Hourly job: challenge results, 1pm coach check-ins, 8pm streak-at-risk and Sunday 6pm weekly check-in (with any target suggestion), in each user's local time |

**Data models:** User · FoodLog · ActivityLog · Kudos · Habit · HabitLog · Challenge · ChallengeParticipant · AIMessage · CoachMemory · Follow · Block · WorkoutPlan · PushDevice · Notification · WeightLog · FavoriteFood · FoodMemory · HealthDay

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for what's done and what's next.

Requests send an `x-utc-offset` header (minutes ahead of UTC) so days and weeks follow the user's local time. Row level security is enabled on every table; only the API reads and writes them.

### Run

All commands below run from the **repo root** unless noted.

```bash
# Install
npm install

# Run migrations (from repo root)
cd packages/backend && npx prisma migrate dev && cd ../..

# Start in watch mode — run from repo root
npm run backend

# Or run directly from the backend package
cd packages/backend && npm run start:dev

# Unit tests, and database tests against DATABASE_URL (a throwaway Postgres)
cd packages/backend && npm test && npm run test:db

# Mobile lint and unit tests
cd apps/mobile && npm run lint && npm test
```

### Environment

```bash
cp packages/backend/.env.example packages/backend/.env
```

See [`packages/backend/.env.example`](./packages/backend/.env.example). The app refuses to boot without `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`. `SUPABASE_SERVICE_KEY` and the Upstash vars are not read by the code yet. Optional: `EXPO_ACCESS_TOKEN` (if push security is on for the Expo project), `PUSH_DISABLED=true` (don't send pushes, e.g. locally), `RATE_LIMIT_PER_MINUTE` (default 300 per signed-in session) and `CORS_ORIGINS` (comma-separated web origins; default any). The server checks its settings at boot and lists anything missing or malformed.

Every response carries an `x-request-id` (also in error bodies), matching one log line per request. Logs are JSON when `NODE_ENV=production`. Sign-in tokens are verified locally against the Supabase project's published signing key. `GET /health` reports the API and database; `POST /client-errors` records crashes reported by the app.

Profile photos go to a public Supabase Storage bucket, `avatars`, which the privacy migration creates along with rules that let each user write only to their own folder.

---

## Cloud Setup

Steps for a fresh Linux cloud instance (CI runner, remote dev box, or coding agent) cloning this repo. Secrets are never committed, so they must be provided as environment variables or `.env` files.

### 1. Install

```bash
git clone https://github.com/coderback/Grit.git && cd Grit
node -v   # must be >= 22.11
npm install
```

`package-lock.json` is gitignored, so dependency versions resolve fresh on each install.

### 2. Configure environment

Either export the variables in the instance's environment / secrets manager, or create the files from the examples:

```bash
cp packages/backend/.env.example packages/backend/.env
cp apps/mobile/.env.example apps/mobile/.env
# then fill in real values
```

Both apps use the **same Supabase project**. Set the mobile app's `EXPO_PUBLIC_API_URL` to the backend's public URL.

### 3. Backend: generate client, migrate, build, run

```bash
cd packages/backend
npx prisma generate          # Prisma client is not committed
npx prisma migrate deploy    # apply committed migrations (never `migrate dev` against a shared DB)
npm run build
npm run start:prod           # listens on $PORT (default 3000)
```

`migrate deploy` uses `DIRECT_URL` (port 5432); the running app uses the pooled `DATABASE_URL` (port 6543).

For a dev loop instead, run `npm run start:dev` after the generate/migrate steps.

### 4. Verify

```bash
npm run typecheck            # from repo root — mobile type-check
cd packages/backend && npm run lint && npm test
```

`npm run test:e2e` boots the full app, so it needs a reachable database and all required env vars.

### 5. Mobile (optional)

A cloud instance can't run a simulator. Use it for type-checking and linting, or run `npx expo start --tunnel` from `apps/mobile` to connect a physical device via Expo Go, or build with `eas build` (requires `EXPO_TOKEN`).

### Deploying the backend (Railway)

[`packages/backend/railway.toml`](./packages/backend/railway.toml) builds with Nixpacks (`npm run build`) and starts `node dist/main`. Set the root directory to `packages/backend`, add the env vars above in Railway, and run `npx prisma migrate deploy` before or as part of each release. Railway's health check calls `GET /health`, which also checks the database.

### CI

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every pull request and push to `main`: the backend job applies the migrations to a throwaway Postgres, checks they match the schema, and runs prettier, eslint, tsc, unit tests, database tests and the build; the mobile job runs tsc, eslint and unit tests.

---

## TDEE Calculation

Onboarding calculates a personalised calorie target using the **Mifflin-St Jeor** formula:

- **BMR:** `10w + 6.25h − 5a + 5` (male) / `10w + 6.25h − 5a − 161` (female)
- **TDEE:** BMR × activity multiplier (1.2 – 1.725)
- **Adjusted calories:** TDEE ± `(7700 × kg_per_week) / 7` based on goal and pace
- **Macros:** Protein 30% · Carbs 40% · Fat 30%

---

## Design System

See [`DESIGN.md`](./DESIGN.md) for the full design token set and visual language documentation.

**Quick reference:**

| Token | Value |
|---|---|
| Background | `#0F0F0F` |
| Surface | `#1A1A1C` |
| Accent (orange) | `#FF5C2B` |
| Success (teal) | `#00C8A0` |
| Text | `#F5F0EB` |
| Muted | `#9A9498` |
| Border | `#2B2B30` |
| Primary font | DM Sans |
| Mono font | JetBrains Mono |

---

## Requirements

- Node 22.11+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI for builds (`npm install -g eas-cli`)
- PostgreSQL via Supabase
- iOS Simulator (Mac) or Android Emulator for local development
