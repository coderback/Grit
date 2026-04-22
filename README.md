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
| `/onboarding` | 10-step personalisation flow (no auth required) |
| `/onboarding/basics` | Gender, date of birth, height, weight |
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
| `/coach` | AI coach chat (Claude-powered) |
| `/barcode-scanner` | Camera barcode scanner (full-screen modal) |

**Auth flow:** New users complete all 10 onboarding screens before any account is created. The personalised plan is revealed first, then sign-up. Returning users land directly at login.

### Run

```bash
# Install
npm install

# Start Expo dev server
npm run mobile

# iOS simulator
cd apps/mobile && npx expo start --ios

# Android emulator
cd apps/mobile && npx expo start --android
```

### Environment

Create `apps/mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Build APK (for device testing)

```bash
cd apps/mobile
eas build --platform android --profile preview
```

The `preview` profile outputs a plain `.apk` (~10–15 min cloud build via EAS).

---

## Backend

**Stack:** NestJS 11 · Prisma 5 · PostgreSQL (Supabase) · Supabase Auth (JWT verification) · Upstash Redis · Anthropic SDK (Claude)

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
| `ai` | `POST /ai/chat` — Claude-powered coach |
| `notifications` | Push token registration, trigger sends |

**Data models:** User · FoodLog · ActivityLog · Habit · HabitLog · Challenge · ChallengeParticipant · AIMessage · Follow

### Run

```bash
# Install
npm install

# Run migrations
cd packages/backend && npx prisma migrate dev

# Start in watch mode
npm run backend
```

### Environment

Create `packages/backend/.env`:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
ANTHROPIC_API_KEY=your_anthropic_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

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
