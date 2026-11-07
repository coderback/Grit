# Trust and safety (Phase 5.1)

What GRIT does to protect users and their data, what the account owner
still needs to set up, and drafts for a lawyer to review. The background is
in the research report's regulation section
([GRIT health fitness nutrition moat](../reports/GRIT%20health%20fitness%20nutrition%20moat.md)).

**This is not legal advice.** Sections 5–7 are drafts written to be reviewed
by a lawyer before launch.

---

## 1. Third-party SDK audit (5 November 2026)

**Rule:** no ad, attribution or analytics SDK may see health data. Any
analytics GRIT adds later must run on GRIT's own server, with event names
that carry no health data.

**Result: no ad, attribution or analytics SDKs in the app or backend.**

| Package or service | What it receives | Verdict |
|---|---|---|
| Supabase (auth, storage) | Sign-in details; profile photos (public bucket) | Service provider. No health data except what's in the database it hosts |
| Expo push service (`expo-notifications`) | Push tokens and the text of each push | **Watch:** push text includes streak counts, the weekly summary (workouts, active minutes, days with food logged) and coach check-ins ("No meals logged for 3 days"). Expo is a service provider, but see recommendation below |
| Azure OpenAI (backend `openai` client) | Meal text and photos, coach chats with a summary of the user's logs | Only after the AI consent in the app; see section 2 |
| Open Food Facts (backend) | Search terms and barcodes, from the server, with no user identity | Fine |
| Apple HealthKit / Health Connect (`@kingstinct/react-native-healthkit`, `react-native-health-connect`) | Read on the phone, sent only to GRIT's backend. If the user turns it on, GRIT writes logged meals (calories, macros, caffeine) back to the phone's health app | Fine; no HealthKit data in iCloud or used for ads |
| AsyncStorage and React Query persistence (`@react-native-async-storage/async-storage`, `@tanstack/*-persist*`), Phase 6 | The workout in progress, finished workouts waiting for a connection, and the cached plan, on the phone only | Fine; nothing leaves the phone. Cleared from the cache on sign-out; a waiting workout is only sent for the account it belongs to |
| Expo modules (camera, image picker, haptics, fonts, secure store, …) | Nothing leaves the phone | Fine |
| `@react-native-community/netinfo` | Checks connectivity; no user data | Fine |
| Google / Apple sign-in | Sign-in only | Fine |
| Upstash Redis (`@upstash/redis`, backend) | Not used by the code yet | Remove, or audit when used |
| Crash reports (`POST /client-errors`) | Error messages and stack traces, to GRIT's own backend logs | Fine; first-party |

**Recommendation:** make push text generic ("You have a new weekly summary")
and keep the numbers in the in-app inbox, which never leaves GRIT. Health
details in push text reach Expo's servers, and also show on a locked
screen.

**Re-check on every release:** run
`node -e "console.log(Object.keys(require('./apps/mobile/package.json').dependencies).join('\n'))"`
and look for analytics, ads, attribution or tracking packages (Firebase
Analytics, Segment, Amplitude, Mixpanel, AppsFlyer, Adjust, Branch, the
Facebook SDK, PostHog and so on).

---

## 2. AI features and Azure OpenAI

### In the app (done)

- **Consent first (Apple guideline 5.1.2(i)):** a sheet explains that Smart
  log, the AI coach and workout plans send what the user types, says or
  photographs, plus a summary of their logs for coach replies, to Microsoft's
  Azure OpenAI service. It asks before the first use.
- **Enforced on the server:** without consent, `POST /food/parse`,
  `POST /ai/message` and `POST /workout-plan/generate` return
  `403 { code: "ai_consent_required" }`. The Home nudge falls back to fixed
  text without calling the model.
- **Withdrawing:** in Settings → Privacy → AI features.
- **Labelled as an AI:** the coach is shown as "AI coach", and says it's an
  AI and not a doctor or dietitian. This meets the EU AI Act's chatbot
  disclosure, in force since 2 August 2026.
- **Refusals in the coach's instructions:**
  - it never claims to be a doctor, dietitian, nutritionist or therapist;
  - no diagnosis, and no reading of symptoms, labs, blood pressure or glucose
    as medical findings;
  - no medication advice (including GLP-1 drugs);
  - never eating below the app's target, skipping meals or "earning" food;
  - crisis or eating-disorder language gets a warm reply pointing to
    emergency services, a helpline or a doctor, instead of coaching.
- **No storage at the model provider:** every call is sent with
  `store: false`.

### In Azure (account owner: to do)

1. **Data Zone deployment:** move the model deployment from a *Global* type
   to a *Data Zone* type (EU or US) in Azure AI Foundry, so prompts are
   processed only in that region. Update `AZURE_OPENAI_DEPLOYMENT` if the
   name changes.
2. **Modified abuse monitoring:** apply to Microsoft for it (the "Azure
   OpenAI limited access review: modified abuse monitoring" form). By
   default, Microsoft can keep prompts its systems flag for up to 30 days for
   human review.
3. **No other Azure features** that store prompts (Assistants, threads, files,
   stored completions) should be switched on for this deployment.

---

## 3. Safety rules (done)

| Rule | Where it's enforced |
|---|---|
| **Adults only (18+):** onboarding's age picker starts at 18. Users without an age (Google or Apple sign-in), or under 18, are sent to a "Before you start" check. The server refuses dates of birth under 18 | `common/safety.ts`, `users.service.ts`, `welcome-check.tsx`, `ProfileGate.tsx` |
| **Calorie floors:** 1,500 kcal for men, 1,200 for everyone else, both in calculated targets and typed ones. The server refuses lower targets | `common/safety.ts`, `lib/safety.ts`, `adaptive.ts`, `users.service.ts`, Goals screen |
| **Loss-rate cap:** planned loss of at most 1% of body weight a week, in onboarding targets, adaptive suggestions and the time-to-goal estimate | Same files, plus `lib/tdee.ts` |
| **Eating-disorder question:** asked in onboarding (and at the "Before you start" check). A "yes" means no weight-loss goal (hidden in the app, refused by the server), adaptive suggestions for maintenance only, and coach instructions to avoid weight-loss talk | `wellbeing.tsx`, `users.service.ts`, `adaptive.service.ts`, `ai.service.ts` |
| **Pro-eating-disorder names:** display names and challenge names containing terms like "thinspo" or "proana" are refused, also when split up ("thin-spo") | `common/safety.ts`, `users.service.ts`, `challenges.service.ts` |
| **Cycle data (Phase 6):** menstrual flow and period days are read only with their own consent (Settings → Health data), off by default. Turning it off deletes what was imported. Cycle data never appears in the feed or challenges, never reaches the coach's context, and notes about it are never kept in coach memory (the model is told not to, and a word filter drops any it proposes). No third-party code runs on its screen | `health.service.ts`, `users.service.ts`, `ai.service.ts`, `coach-memory.ts`, `settings/health.tsx` |
| **Health data in other users' view:** a workout logged set by set shows in the feed as counts only (sets and PRs), never weights | `social.service.ts` |
| **Separate data permissions**, all off by default: improving food data, training on health data, training on workout data, and sharing products with Open Food Facts. Since Phase 7, "Improve GRIT's food data" decides whether a user's logs count toward a food's popularity, which shapes everyone's search ranking. The others record the user's choice for when GRIT uses them | Settings → Privacy, `food.service.ts` |
| **Nutrient wording (Phase 7):** nutrients are "low" or a "good source", never "deficient" or anything diagnostic. Only finished days that were logged fully enough are judged, and only on nutrients most of the day's calories carry, so missing data is never read as low. The coach suggests everyday foods that fit the user's diet, never supplements, and the "running low" check-in isn't sent to users who answered yes to the eating-disorder question. Targets are US Dietary Reference Intakes; the Nutrients screen says they don't cover pregnancy or breastfeeding | `nutrients/`, `ai.service.ts`, `coach-checkins.ts`, `app/nutrients.tsx` |

**To review with a dietitian:** the floors and the loss-rate cap are the
clinical rules of thumb from the research, not law.

**Not covered yet:** GRIT's feed has no free-text posts or comments, so
names are the only user-written text other people see. If posts or comments
are added, they need the same check plus reporting.

---

## 4. Store declarations (account owner: to do)

- **Google Play, health apps declaration** (Play Console → App content →
  Health apps):
  - list every health feature: nutrition tracking, activity and workouts,
    weight, sleep and steps from Health Connect, an AI coach, and
    challenges;
  - for each Health Connect permission GRIT requests, describe the feature
    that uses it (the same reasons are on the app's Health data screen):
    - exercise, steps, distance: workouts and steps count toward goals and
      challenges;
    - heart rate: workout calories from heart rate;
    - sleep, heart rate variability, resting heart rate, respiratory rate,
      skin temperature: recovery, for the coach and the progression rules;
    - VO2max: the fitness trend;
    - weight: the weight trend and calorie targets;
    - menstruation (only after the in-app cycle consent): the user's own
      cycle record, not shared;
    - write nutrition (only if the user turns it on): logged meals in
      Health Connect;
    - read health data history: the first sync imports two months.
  - GRIT doesn't request background read; add it to the declaration if
    background sync is built.
- **The privacy policy shown in Health Connect must be the same one as on
  the Play listing.**
- **Apple App Store privacy labels:**
  - Health & Fitness, collected and linked to the user;
  - not used for tracking.
- **Apple HealthKit:** the app now asks to write nutrition (with
  `NSHealthUpdateUsageDescription`), only when the user turns on writing
  meals; App Review checks that the text matches.

---

## 5. Draft: consumer health data privacy notice

*Draft for legal review. It's needed for Washington's My Health My Data Act
and similar US state laws (Nevada, Connecticut and others), and works
alongside the main privacy policy.*

**What consumer health data GRIT collects:**
- **What you enter:** food and drinks, workouts, habits, weight, height, date
  of birth, sex, goals, your answer to the eating-disorder question, chats
  with the AI coach, and the coach's notes about you.
- **From your phone's health app, if you connect it:** workouts (with heart
  rate and distance), steps, sleep, weight, heart rate variability, resting
  heart rate, breathing rate, sleeping temperature and VO2max; and, only if
  you turn on cycle data separately, period days and flow.
- **Cycle data** is used only to show you your own record. It's never
  shared with other users or sent to the AI coach, and turning it off
  deletes it.
- **Inferred:** calorie and macro targets, estimates of how much you burn,
  and the patterns behind coach check-ins.

**Why:** to provide the features you use, which means logging, targets,
coaching, challenges and reminders. Not for advertising.

**Who it's shared with:**
- **Service providers that run GRIT:** Supabase (database and sign-in),
  Railway (servers), Microsoft Azure OpenAI (AI features, only with your
  permission) and Expo (push notifications).
- **Other GRIT users,** as your privacy settings allow (activity in the
  feed).
- **Never sold.** Never shared with advertisers.

**Your rights:**
- See, download or delete your data. "Delete account" in Settings deletes
  everything.
- Withdraw permission for AI features, or for any data-use setting, at any
  time.

**Contact:** *[support email]*.

---

## 6. Draft: data protection impact assessment (outline)

*Required under GDPR (and the UK GDPR) for large-scale processing of health
data and for profiling, and under Nigeria's GAID 2025 for the same. To be
completed with a lawyer.*

1. **Processing described:**
   - **Data:** the categories in section 5.
   - **Purposes:** logging, targets, AI coaching, social features and alerts.
   - **Lawful basis:** contract for core features; **explicit consent**
     (GDPR Article 9(2)(a)) for health data and AI processing; separate
     explicit consent for any model training.
2. **Necessity:** each data field is linked to the feature that uses it;
   remove fields no feature uses.
3. **Risks and mitigations:**
   - **Health data reaching ad tech:** no third-party SDKs (section 1).
   - **AI provider exposure:** consent, Data Zone, `store: false`, modified
     abuse monitoring.
   - **Eating-disorder harm:** floors, loss cap, the question, coach rules,
     and moderation of names.
   - **Minors:** 18+ gate.
   - **Profile photos are public:** keep the bucket limited to avatars.
   - **Breach:** the 72-hour notice rule (GDPR, Nigeria).
4. **Transfers:** where Supabase, Railway and Azure process data, and
   standard contractual clauses for the EU and UK.
5. **Representatives:** an EU and UK representative if GRIT has EU or UK users
   and no establishment there.
6. **Sign-off and review date.**

---

## 7. For the lawyer

- The section 5 notice, and Washington consent flows (MHMDA requires separate
  consent to collect and to share consumer health data).
- The section 6 assessment, and EU and UK representatives.
- How the UK Online Safety Act applies to GRIT's feed (eating-disorder
  content is primary priority content for children; GRIT is 18+).
- Texas App Store Accountability Act age signals.
- Registration with Nigeria's NDPC if GRIT has Nigerian users above the
  thresholds.
- Whether the push text in section 1 needs changing. Phase 7's "running
  low" check-in names the nutrient ("Iron has been running low"), like the
  existing protein check-in.
- **Food data licences (Phase 7):**
  - **Open Food Facts (ODbL 1.0 for the database, DbCL for contents, CC
    BY-SA for images):** GRIT stores OFF products in the same tables as
    USDA and the UK's CoFID, and merges the same product from two sources
    by barcode, which likely makes a Derivative Database rather than a
    Collective one. Does share-alike then require offering GRIT's food
    tables (or the OFF-derived part, plus the importer code) under the
    ODbL? Would keeping OFF rows separable, which `food_sources` already
    allows, and publishing a periodic dump of them satisfy it? Where must
    the attribution appear? Today it's under Profile → Food data sources.
    The barcode lookup already saves OFF products it finds; every saved
    row is marked `source = 'off'`, so they can be removed in one step.
  - **UK CoFID (Open Government Licence v3.0)**, imported with the required
    statement in the app.
  - **USDA FoodData Central** is public domain; credited as a courtesy.
  - **Canada's CNF (OGL – Canada), France's CIQUAL (Licence Ouverte) and
    Finland's Fineli (CC BY 4.0):** confirm each before they're imported.
