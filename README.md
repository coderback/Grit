# GRIT

A full-stack fitness and nutrition tracking app for people serious about body composition. GRIT combines macro tracking, habit building, activity logging, social challenges, and an AI coach into a single opinionated dark-mode mobile experience.

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
| `/onboarding/signup` | Account creation (email + password) |
| `/(auth)/login` | Returning user login |
| `/(tabs)/` | Home — daily calorie target + macro progress |
| `/(tabs)/food` | Food log — meal sections + barcode scanner |
| `/(tabs)/habits` | Habit tracker — daily check-ins + streaks |
| `/(tabs)/activity` | Activity log — workouts + weekly chart |
| `/(tabs)/social` | Challenges feed + leaderboard |
| `/(tabs)/profile` | User profile + settings |
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
| `auth` | JWT guard, Supabase token verification |
| `users` | `GET/PUT /users/me`, `GET /users/:id` |
| `food` | `GET/POST/DELETE /food-logs`, Open Food Facts proxy |
| `activity` | `GET/POST/DELETE /activity-logs` |
| `habits` | `GET/POST /habits`, `POST /habits/:id/complete` |
| `challenges` | `GET/POST /challenges`, join by invite code |
| `social` | Feed, follow/unfollow, kudos |
| `ai` | `POST /ai/message` (streamed), `GET /ai/messages`, `GET /ai/nudge` — AI coach |
| `notifications` | Push token registration, trigger sends |

**Data models:** User · FoodLog · ActivityLog · Habit · HabitLog · Challenge · ChallengeParticipant · AIMessage · Follow

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
```

### Environment

```bash
cp packages/backend/.env.example packages/backend/.env
```

See [`packages/backend/.env.example`](./packages/backend/.env.example). The app refuses to boot without `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`. `SUPABASE_SERVICE_KEY` and the Upstash vars are not read by the code yet.

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

[`packages/backend/railway.toml`](./packages/backend/railway.toml) builds with Nixpacks (`npm run build`) and starts `node dist/main`. Set the root directory to `packages/backend`, add the env vars above in Railway, and run `npx prisma migrate deploy` before or as part of each release.

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
