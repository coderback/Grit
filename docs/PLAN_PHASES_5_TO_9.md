# Plan: Phases 5–9

GRIT's next stage, split into five phases ordered **from easiest to
hardest**. Each phase can be built, tested and released on its own, and
each one sets up the data or infrastructure the next needs.

| Phase | Name | Kind of work | Weeks (one developer) |
|---|---|---|---|
| **5** ✅ | Quick wins and safety | App and backend changes on what GRIT already has; no new infrastructure | about 3 |
| **6** ✅ | Strength logging and health data | Large app features and native health permissions; product work, no research | about 5 |
| **7** ✅ | GRIT's own food database | Data pipelines, bulk imports, search performance, a Supabase upgrade | about 4 |
| **8** | Data quality and regional foods | Contributions, moderation, merging duplicates, curating regional data | about 3 |
| **9** | ML and research | Test sets, models and statistics; research-heavy and needs real usage data | about 5 |

That's about 20 weeks one after the other, slightly more than the single
Phase 5 plan it replaces (18 weeks), because each phase now ends with its own
release. With two developers, Phases 6 (fitness) and 7 (food) can run in
parallel, which brings it to about 15.

**Why this shape:** the research
([GRIT health fitness nutrition moat](../reports/GRIT%20health%20fitness%20nutrition%20moat.md))
found that in 2026 most single features became free or bundled elsewhere:
- Apple's adaptive strength plans;
- Strava's set logging;
- food logging inside the Google, Samsung and Garmin coaches;
- WHOOP's coach memory.

GRIT's moat is therefore the links between nutrition, training, recovery and
friends, and these phases build the data those links need. GRIT launches
globally; regional food data is added where users' searches miss.

Other background: [MARKET_RESEARCH.md](./MARKET_RESEARCH.md) and
[ROADMAP.md](./ROADMAP.md).

**Every phase ends the same way:**
- additive migrations, applied to Supabase after the deploy;
- database and unit tests for the new parts;
- end-to-end checks in the web build and, where native code changed, on a
  development build;
- ROADMAP and README updates;
- one pull request per phase.

---

## What it builds on

- **Search and barcodes:** `FoodService.searchFoods` and `lookupBarcode`
  call Open Food Facts live, with a 10-minute in-memory cache.
- **Smart log** (`meal-parse`) grounds items in the user's `FoodMemory`
  first, then Open Food Facts for branded items, then a checked estimate.
  Generic foods (eggs, rice) always fall back to the estimate today.
- **Food logs** (`FoodLog`) store calories and macros only, with
  `servingQty`/`servingUnit`. There are no micronutrients yet.
- **User profiles** have `gender` and `dateOfBirth`, which is enough to pick
  each person's daily micronutrient targets.
- **The coach** already reads the week's averages, the adaptive estimate and
  coach memory, which records injuries ("sore left knee; avoid jumping").
- **Activity logs** (`ActivityLog`) hold an activity type (20 types), a
  duration, optional steps, and calories from a fixed MET value per type
  times body weight. Workouts from Apple Health / Health Connect arrive the
  same way.
- **Workout plans** (`WorkoutPlan.days`) are coach-generated JSON, with each
  exercise as free text (`{ name, detail: "3 × 12" }`). Nothing links them
  to a known exercise, and nothing records what was lifted.
- **Health import** reads workouts, steps, sleep duration and weight into
  `ActivityLog`, `HealthDay` and `WeightLog`.

## Success measures

Phase 5 starts recording search choices and corrections, so every later
change is measured against a real baseline.

| Measure | How | Target | Phase |
|---|---|---|---|
| Third-party SDKs on health screens | Ad, attribution or analytics SDKs that can see health data | 0 | 5 |
| Plan exercises linked | Share of exercises in new coach plans that come from the library | 100% | 5 |
| Plan workouts logged with sets | Share of strength days in a plan that get logged set by set | ≥ 50% of active plan users | 6 |
| Logging speed | Taps to log a set that repeats last time's numbers | 1 tap | 6 |
| Burn estimates with heart rate | Share of imported workouts whose calories use heart rate | Report only (depends on devices) | 6 |
| First-search success | Share of searches where the user picks a result without searching again | Beat the Phase 5 baseline by 15 points | 7 |
| Search speed | p95 time of `GET /food/search` | ≤ 300 ms | 7 |
| Barcode hit rate | Share of scans that find a product, per country | ≥ 90% in the 5 countries with the most users, ≥ 75% elsewhere | 7–8 |
| Verified share | Share of logs from measured or verified entries | ≥ 85% | 8 |
| Search misses by country | Share of searches with no result picked, per country and language | Report monthly; decides where regional depth goes | 8 |
| Correction rate | Share of logged foods whose numbers the user edits | Halve the Phase 5 baseline | 9 |
| Micronutrient coverage | Share of a day's logged calories with a full micronutrient profile | ≥ 60% measured only (7); ≥ 80% with estimates (9) | 7, 9 |

---

# Phase 5 — Quick wins and safety (about 3 weeks) ✅ done

**Difficulty: low.** Everything here extends code GRIT already has. No new
infrastructure, no native modules, no research.

## 5.1 Trust and safety baseline (week 1)

**Why first:** the feed, the AI coach, Smart log and health sync are already
in production, and several rules apply to them now.

- **Third-party SDK audit:** list every SDK in the app and backend, and
  confirm none can see health data. The rule is no ad, attribution or
  analytics SDKs on any screen that shows health data. Any analytics are
  server-side, with event names that carry no health data. This is the
  pattern behind the GoodRx, BetterHelp and Flo/Meta cases, and Washington's
  health-data law.
- **AI consent (Apple guideline 5.1.2(i), since November 2025):** before the
  first meal photo or coach message, a screen says that the content goes to
  Microsoft's Azure OpenAI service, and asks for permission. Without
  permission, the app offers manual logging only.
- **Azure set-up:**
  - an EU or US Data Zone deployment instead of Global;
  - stateless API calls;
  - a request to Microsoft for modified abuse monitoring, so flagged content
    isn't kept.
- **Saying the coach is an AI:** the EU AI Act has required this since
  August 2026. The coach screen is labelled "AI coach" and says it's an AI on
  first use. It never calls itself a nutritionist, dietitian or therapist.
- **Refusals in the coach's instructions:** no diagnosing and no medication
  dosing. Crisis and eating-disorder language gets a supportive reply and
  links to resources instead of coaching.
- **Age:**
  - 18+ sign-up, using the platforms' age signals where they exist (the
    Texas App Store Accountability Act is enforceable);
  - under the UK Online Safety Act, eating-disorder content must be kept from
    children on apps with a social feed, which GRIT has.
- **Calorie safety:**
  - calorie floors, about 1,200 kcal for women and 1,500 for men, and a cap on
    weekly loss rate, both reviewed with a dietitian;
  - a short eating-disorder screen at onboarding, with no weight-loss
    targets for anyone it flags;
  - moderation of the feed for pro-eating-disorder content.
- **Consent settings:** separate settings, all off by default (decision 7):
  - use of food logs and corrections to improve the food data;
  - use of health data to train models;
  - use of workout data to train models;
  - sharing contributed products with Open Food Facts.
- **Documents, drafted for a lawyer:**
  - a consumer health data privacy notice, covering Washington and other
    states;
  - a data protection impact assessment (GDPR, Nigeria's GAID 2025);
  - a Play Store health apps declaration that matches the privacy policy
    shown in Health Connect.

## 5.2 Smart log accuracy users can see (week 2)

Studies find AI meal estimates go most wrong on fat and protein. All of
this changes only the existing `meal-parse` service and Smart log sheet:

- **Confidence badge** on every item: your usual, database, or estimate,
  with low / medium / high confidence.
- **One cooking-fat question:** when oil or butter is likely and unstated,
  ask "Cooked in oil? None / a little / a lot", and add the oil as its own
  item.
- **Protein and fat checks** against the food's category: for example,
  grilled chicken can't come back at 2 g protein per 100 g. Failing items are
  marked "check this".

## 5.3 Caffeine, alcohol and search data (week 2)

- **Caffeine and alcohol:**
  - `FoodLog` gains nullable `caffeineMg` and `alcoholG` columns, filled from
    Open Food Facts where it has them and from the model's reading in Smart
    log;
  - a quick "drinks" shortcut logs coffee, tea, beer and wine with known
    values;
  - daily totals on the Food tab, and both join the coach's context.
- **Recording searches:**
  - a small `search_events` table (query, chosen food or none, position, the
    user's country and app language);
  - a correction flag on `FoodLog`, set when the user changes a picked
    food's numbers.

  Neither changes what users see. They give Phase 7's baseline and Phase
  8's "search misses by country" measure their data.

## 5.4 Exercise library and coach plans (week 3)

### Sources

| Source | What | Licence |
|---|---|---|
| **free-exercise-db** | About 800 exercises, with primary and secondary muscles, equipment, level, instructions and images | Public domain (Unlicense) |
| **wger** | About 400 exercises in many languages | CC BY-SA 4.0 (share-alike); images vary. Names and translations only, kept traceable |
| **2024 Adult Compendium of Physical Activities** | MET values for about 1,100 activities by intensity, such as running at each pace | Free to use with citation; confirm terms |

### Schema

```prisma
model Exercise {
  id           String   @id @default(cuid())
  name         String
  aliases      String[] // "RDL" = "Romanian deadlift"
  primary      String[] // muscles, e.g. ["hamstrings", "glutes"]
  secondary    String[]
  equipment    String[] // barbell | dumbbell | machine | cable | bodyweight | band | kettlebell
  mechanics    String?  // compound | isolation
  level        String?  // beginner | intermediate | advanced
  // Movement pattern, e.g. "squat", "hip_hinge", "horizontal_press".
  // Swapping a back squat for a goblet squat keeps progression history.
  pattern      String?
  // Tags the coach uses to avoid exercises for an injury, e.g.
  // "high_impact", "spinal_load", "overhead", "deep_knee_flexion"
  stresses     String[]
  instructions String?
  imageUrl     String?
  met          Float?   // typical MET, for calories
  @@map("exercises")
}
```

- **Curated tags:** `stresses` and `pattern` are curated by hand for the
  roughly 150 most common exercises. That's what lets "sore left knee; avoid
  jumping" in coach memory exclude box jumps and deep lunges automatically.
- **Library search** in the app, by name, muscle and equipment.
- **Coach plans from the library:** plan generation gets a shortlist of about
  80 exercises, already filtered by equipment, location (home or gym), level
  and coach-memory restrictions. The strict JSON schema takes their IDs as an
  enum, so the model can't invent exercises. Plans then show images and
  instructions.
- **Calories from intensity:** the 20 activity types are mapped to
  Compendium codes, with an intensity choice where it matters (running pace;
  easy, moderate or hard cycling). This replaces the fixed MET table, and
  existing logs keep their calories.

**Exit for Phase 5:**
- **Safety:** the SDK audit is written down, with zero third-party SDKs on
  health screens; the AI consent screen and AI label are live; the age gate
  and calorie floors are covered by tests.
- **Smart log:** badges, the oil question and the checks are covered by
  tests.
- **Data:** search events and corrections are being recorded.
- **Plans:** new coach plans contain only library exercises, and a plan for
  someone with a knee note contains no exercise tagged with knee stresses.

---

# Phase 6 — Strength logging and health data (about 5 weeks) ✅ done

**As built** (details in [ROADMAP.md](./ROADMAP.md)): everything below,
with these differences:
- **Offline:** the workout in progress lives in a store saved on the phone,
  and the finished workout is sent whole. The upload is a persisted React
  Query mutation, so it waits for a connection and survives a restart; the
  backend saves it once per `clientId`, so a resend never duplicates.
- **Schema:** `WorkoutSession` also stores `clientId`, a title and summary
  counts (sets, volume, PRs) for the feed; `WorkoutSet` adds `userId` (for
  per-exercise history), `durationSec` (timed sets) and the PR it set;
  `WorkoutPlan.nextSession` holds the session order; `ActivityLog` adds
  `calorieMethod` (device, heart_rate, met or manual), which measures
  "burn estimates with heart rate"; `User.consentCycleData` is cycle data's
  own consent.
- **Swaps** keep history by borrowing from the same movement on the same
  equipment (weights on different equipment aren't comparable).
- **Deloads** last one session, then double progression climbs back, so no
  increase is ever more than 5%.
- **Heart-rate calories** apply when the device gives no calories of its
  own, and only from 90 to 200 bpm, the equation's range.
- **Health Connect background read** isn't requested: GRIT syncs while
  open, and Play rejects unused permissions. The history permission is
  requested, and the first sync reads two months.
- **Water** isn't written back: GRIT doesn't record water amounts yet.


**Difficulty: medium.** Large app features and native health permissions,
but no research. Needs a development build on real phones for the health
parts.

**Depends on:** Phase 5's exercise library.

## 6.1 Strength logging (weeks 1–3)

### Schema

```prisma
// One training session, linked to an ActivityLog so the feed, challenges,
// calories and streaks keep working unchanged
model WorkoutSession {
  id            String   @id @default(cuid())
  userId        String
  activityLogId String   @unique
  // Which session of the plan this was (1, 2, 3…). Plans run in order, so a
  // missed Tuesday moves the week along instead of skipping the session.
  planSession   Int?
  startedAt     DateTime
  endedAt       DateTime?
  sets          WorkoutSet[]
  @@map("workout_sessions")
}

model WorkoutSet {
  id         String  @id @default(cuid())
  sessionId  String
  exerciseId String
  order      Int
  reps       Int
  weightKg   Float?  // null for bodyweight
  rpe        Float?  // optional effort, 6–10
  warmup     Boolean @default(false)
  supersetId String? // sets sharing one are a superset or circuit
  @@map("workout_sets")
}
```

### App

Logging alone is now free elsewhere (Hevy, Strava, Apple), so it has to be
the fastest anywhere:

- **Start a workout:** "Start today's workout" from Home or the plan opens a
  session with the plan's exercises.
- **Logging sets:**
  - each exercise shows last time's sets, so repeating them is one tap;
  - rest timers that differ by set type (warm-up, working, superset);
  - supersets and circuits;
  - free plate and warm-up calculators;
  - adding, swapping or reordering exercises, where a swap keeps history
    through the movement pattern;
  - **personal records** marked as they happen.
- **"Say it" (week 3):** saying "bench 80 for 8, 8, 7" logs three sets, using
  the Smart log pipeline with a workout schema.
- **Offline (week 3):**
  - sets save on the phone and sync when back online, using React Query's
    persisted mutations;
  - a session is only ever edited on one phone, so there are no conflicts to
    merge.
- **Plans run by session order, not weekday:** "next up: session 2" rather
  than "Tuesday", so missed days don't break the plan. This is a common
  complaint about RP Hypertrophy and Runna.
- **Finishing** creates the `ActivityLog` (type `strength_training`) and
  posts to the feed as today.
- **History per exercise:** a weight-over-time chart, and an estimated
  one-rep max (Epley formula, up to 10 reps).
- **Quick logging** of other activities stays as it is.

## 6.2 Progression rules (week 4)

Deterministic rules, not a model, so they're testable and explainable:

- **Double progression:** once every set reaches the top of the rep range,
  add the smallest step the equipment allows (usually 2.5 kg; lower body
  5 kg).
- **Load-jump caps:** never more than one equipment step at a time, or 5%,
  whichever is smaller.
- **Stalls:** after two sessions with no progress on a lift, or two missed
  sessions, drop it by 10% for a week (a deload).
- **Nutrition and recovery,** from the research evidence:
  - **deficit:** averaging more than 500 kcal a day below the Phase 4
    adaptive estimate switches the goal to **"preserve"**: hold weights and
    keep volume. At that deficit, strength can still rise but muscle gain
    stalls (Murphy and Koehler, 2022);
  - **protein:** under 1.6 g per kg of body weight on most of the last 7 days
    holds increases. Gains above that level are small (Morton, 2018);
  - **sleep:** after a night under 6 h (from health data), keep today's
    weights instead of adding.
- **Explanation:** the coach explains every change ("holding your squat this
  week: you're in a deficit and slept 5 h").
- **Naming:** described as rules, never marketed as "AI".

## 6.3 Wider health import and heart-rate calories (week 5)

- **New data, read from Apple Health and Health Connect** with permission:
  - heart rate variability: Apple gives SDNN and, from iOS 27, RMSSD;
    Health Connect gives RMSSD. Store which, so values aren't compared across
    types;
  - resting heart rate;
  - respiratory rate;
  - sleeping temperature deviation;
  - VO2max;
  - menstrual flow and cycle days;
  - per workout: average heart rate and distance.
- **Storage:** a `HealthMetric` table (user, day, metric, value, unit,
  source app or device, type), plus `avgHeartRate` and `distanceM` on
  `ActivityLog`.
- **Android:** request Health Connect's background-read and history
  permissions (data older than 30 days), with a clear reason shown for each.
- **Cycle data is special:**
  - never shown in the feed or challenges;
  - never written into coach memory;
  - covered by its own consent;
  - no third-party code on its screens (the Flo case).
- **Heart-rate calories:** when a workout has average heart rate, calories
  use the published heart-rate equations, which take age, sex and weight
  (Keytel et al., 2005). Otherwise the Phase 5 intensity METs apply.
- **Writing nutrition back:** with permission, logged meals' energy, macros,
  caffeine and water go to Apple Health and Health Connect (HealthKit
  dietary samples, Health Connect `NutritionRecord`).

**Exit for Phase 6:**
- **Logging:** a full plan session can be logged on a phone with one tap per
  repeated set, by voice, and with the phone offline. It appears in the feed,
  counts toward challenges and shows PRs.
- **Rules:** progression rules are covered by unit tests over scripted
  histories, with no single increase above 5%.
- **Health data:** imported values match the phone's own health app on test
  devices, and a second sync changes nothing.

---

# Phase 7 — GRIT's own food database (about 4 weeks) ✅ done

**As built** (details in [ROADMAP.md](./ROADMAP.md)): everything below,
with these differences:
- **Schema:**
  - `Food` also has `source` (whose values it shows), `searchText` (name,
    brand and other names without accents, for search) and `imageUrl`;
  - `FoodLog` has `foodId`, `grams` and the `nutrients` snapshot;
    `FoodMemory` and `FavoriteFood` have `foodId` (and favourites `grams`),
    so remembered and saved foods keep their nutrients;
  - `SearchEvent` has `kind` (search or barcode), `resultCount` and
    `pickedId`, for first-search success, the barcode hit rate and the
    verified share.
- **Search** is trigram matching on `searchText` (every word must appear,
  plurals included, then a typo-tolerant search when that finds few), not
  full text plus trigram: one index serves every language and typos, and
  Prisma can describe it, so CI's schema check still passes. Queries need
  3 characters. Synonyms are one list of single words
  (`src/food/synonyms.ts`: yoghurt = yogurt, courgette = zucchini, prawn
  = shrimp…) rather than a file per language; `FoodName` holds other names,
  and they're searched too.
- **Live Open Food Facts search stays** as a fallback (`FOOD_LIVE_SEARCH`)
  until its full import is in: the "no live calls except barcode misses"
  exit applies once it is.
- **Importer keys** are stable across USDA releases (`ndb:<NDB number>`,
  `fndds:<food code>`, `branded:<GTIN-13>`), since USDA gives revised
  foods new ids. Foundation and SR Legacy are one food per NDB number.
- **Open Food Facts** has two data shapes now (its exports and daily
  changes use a new one); both are read, and only label values are kept.
  The CSV export can't tell OFF's estimates from labels, so it imports
  energy and macros only.
- **Size:** the full Open Food Facts and USDA branded imports would take
  12–14 GB as stored, well over the 2–4 GB estimated here. They aren't
  imported yet (see ROADMAP).
- **National tables:** the UK's CoFID is imported. Canada's, France's and
  Finland's sites couldn't be downloaded from a server, so those wait for
  the files.
- **Smart log** matches unbranded items to measured foods and branded
  items to branded foods first, and only when the calories agree with the
  reading. Branded before measured, for branded items, keeps "Fage yogurt"
  from becoming generic yogurt.
- **Today** is never called low on the Nutrients screen, since it's still
  being logged; a limit already passed (sodium, saturated fat) still
  shows.
- **Sugars** are shown without a limit: the advice is about added sugars,
  which tables and labels rarely give.


**Difficulty: medium-high.** Data pipelines and infrastructure: bulk imports
of millions of rows, search that stays fast, a daily refresh job, and a
licence check.

**Before starting:**
- upgrade to Supabase Pro (decision 1);
- have a lawyer confirm how GRIT uses Open Food Facts under ODbL (decision 3).

**Depends on:** Phase 5's search events, for the baseline.

## 7.1 Schema and importers (weeks 1–2)

New tables, separate from the per-user ones. Values are stored per 100 g,
in standard units:

```prisma
// One food, however many products and sources describe it
model Food {
  id          String   @id @default(cuid())
  name        String
  brand       String?
  kind        String   // generic | branded | dish | restaurant | user
  category    String?
  ingredients String?  // as printed, for branded foods
  countries   String[] // where it's sold, e.g. ["gb", "us"]
  quality     Float    @default(0)   // 0–1, see Phase 8
  popularity  Int      @default(0)   // logs by GRIT users
  verified    Boolean  @default(false)
  updatedAt   DateTime @updatedAt

  barcodes  FoodBarcode[]
  servings  FoodServing[]
  nutrients FoodNutrient[]
  names     FoodName[]
  sources   FoodSource[]
  @@map("foods")
}

model FoodBarcode {
  code   String @id // normalised to GTIN-13
  foodId String
  food   Food   @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@map("food_barcodes")
}

// "1 slice = 28 g", "1 cup = 240 g"
model FoodServing {
  id      String  @id @default(cuid())
  foodId  String
  label   String
  grams   Float
  typical Boolean @default(false) // the default portion (Phase 9)
  food    Food    @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@map("food_servings")
}

model FoodNutrient {
  foodId   String
  nutrient String  // code from the nutrient list below, e.g. "iron_mg"
  amount   Float   // per 100 g
  basis    String  // measured | label | estimated
  low      Float?  // range, for estimates (Phase 9)
  high     Float?
  food     Food    @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@id([foodId, nutrient])
  @@map("food_nutrients")
}

// Local and alternative names, per language: "aubergine" (en-GB) for
// eggplant, "eba" (yo) for garri paste. Used from Phase 8.
model FoodName {
  id     String @id @default(cuid())
  foodId String
  name   String
  lang   String // BCP 47, e.g. "en-GB", "yo", "hi"
  food   Food   @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@index([name])
  @@map("food_names")
}

// Where each food came from, so values can be traced and refreshed
model FoodSource {
  id         String   @id @default(cuid())
  foodId     String
  source     String   // fdc | off | cofid | cnf | ciqual | fineli | fao_* | national_* | user
  externalId String
  fetchedAt  DateTime
  food       Food     @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@unique([source, externalId])
  @@map("food_sources")
}
```

**Nutrients tracked (28 codes)**, kept in one `nutrients.ts` list with units
and display names:
- **Energy and macros:** kcal, protein, carbs, sugars, fat, saturated fat,
  fibre, sodium.
- **Vitamins:** A, C, D, E, K, B1, B2, B3, B6, B12, folate.
- **Minerals:** calcium, iron, magnesium, potassium, zinc, phosphorus,
  selenium.
- **Other:** caffeine and alcohol, which move from Phase 5's `FoodLog`
  columns to the food data.

**Importers:** scripts in a new `packages/food-data/` package (TypeScript,
run with Node). Each one is idempotent: matched on
`FoodSource(source, externalId)`, so re-running it updates rows instead of
duplicating them.

| Source | What | Licence |
|---|---|---|
| USDA FoodData Central: Foundation, SR Legacy, FNDDS | ~13k generic and survey foods, full panels, household portions | Public domain |
| USDA FoodData Central: Branded | ~400k US products, label nutrients | Public domain |
| Open Food Facts | ~3M products from about 150 countries, names in many languages | **ODbL** (decision 3) |
| UK CoFID | UK foods | Open Government Licence |
| Canada CNF, France CIQUAL, Finland Fineli | National foods | Open licences; confirm each |

- **Size:** filtered Open Food Facts plus everything else is roughly 2–4 GB.
  Only products with a name and calories are imported, using bulk `COPY` into
  staging tables.
- **Duplicates:** same normalised barcode = same food. Smarter merging is in
  Phase 8.
- **Generic foods:** where several national tables list the same food, each
  is kept and tagged with its country, so search can prefer the user's
  country.
- **Refresh:** Open Food Facts publishes daily changes, imported by a
  scheduled job (a GitHub Action or a Railway cron service). FoodData Central
  releases about twice a year; the importer re-runs on each release.

## 7.2 Local search, barcodes and Smart log (week 3)

- **Search:**
  - Postgres full-text plus trigram search (`pg_trgm`) over names, brands and
    synonyms;
  - ranking, in order: the user's own foods (`FoodMemory`, favourites,
    recent), then foods sold in their country, then `quality`, then
    `popularity`;
  - a synonyms file per language (courgette = zucchini, and so on);
  - move to Typesense or Meilisearch only if p95 stays over 300 ms.
- **Barcodes:** look up `FoodBarcode` locally, with Open Food Facts live as
  the fallback. Anything found that way is saved, so the next scan is local.
- **API:**
  - `GET /food/search` and `GET /food/barcode/:code` keep their shape and add
    `foodId`, `servings` and `nutrients`;
  - `NormalizedFood` gains those fields as optional, so older app builds keep
    working.
- **Smart log:**
  - generic items are matched to the database by the top search result above
    a similarity threshold, until Phase 9's name matcher;
  - the source order becomes memory → measured database → branded database
    → estimate.
- **Mobile:**
  - search results show serving choices ("1 slice (28 g)");
  - "Verified" labels;
  - the log sheet lets you pick a serving instead of typing grams.

## 7.3 Micronutrients in the app, measured values only (week 4)

- **Storage:** `FoodLog.nutrients Json?`, the eaten amount's nutrients saved
  at log time as `{ iron_mg: { amount, basis } }`. A snapshot, so later
  database fixes don't silently change past days.
- **Targets:** daily values by age and sex from the US Dietary Reference
  Intakes (a public NIH table), in `common/dri.ts`.
- **API:**
  - `GET /nutrients/day?date=`: totals against targets, plus how much of the
    day's calories have nutrient data;
  - `GET /nutrients/week`: nutrients that were low on most logged days.
- **App:**
  - a **Nutrients** view, opened from the Food tab's macro card, with a
    coverage note ("Based on 64% of today's calories");
  - an "Often low this week" card on Stats.
- **Coach:**
  - often-low nutrients join its context, so it can suggest foods that fit
    the user's diet;
  - a check-in rule fires when the same nutrient is low 5 of the last 7
    logged days.
- **Wording:** "low" and "good source", never "deficient" or anything
  diagnostic.
- **Only measured and label values** are shown in this phase; estimates come
  in Phase 9.

**Exit for Phase 7:**
- **No live calls:** the app runs on the local database, with no live Open
  Food Facts calls except barcode misses.
- **Speed:** search p95 is at most 300 ms on production data.
- **Imports:** a re-run of any importer changes nothing.
- **Nutrients:** a day logged from verified foods shows totals that match a
  hand calculation.

---

# Phase 8 — Data quality and regional foods (about 3 weeks)

**Difficulty: medium-high.** Moderation, merging and curating data take
judgement as well as code.

**Depends on:** Phase 7's database, plus a few weeks of Phase 5's search
events to see where searches miss.

## 8.1 Adding missing products (week 1)

- **Flow:** after a barcode miss, the app offers "Add it": photograph the
  nutrition panel and the ingredients. Smart log's vision call reads both
  into a draft for the user to confirm.
- **Automatic checks:**
  - calories within 15% of 4·protein + 4·carbs + 9·fat;
  - each nutrient within physical limits;
  - serving size consistent with the per-100 g values.
- **Verification:**
  - a second user's scan that agrees marks it verified;
  - until then it's labelled unverified, ranks lower, and other users only see
    it once it passes the checks.
- **Sharing back:** with the user's consent, the product goes to Open Food
  Facts through its write API.
- **Abuse:** submissions are rate-limited and can be reported, and a food with
  repeated corrections drops out of search until it's reviewed.

## 8.2 Quality and duplicates (week 2)

- **Quality score** per food, from 0 to 1, used in search ranking. It weighs:
  - how trustworthy the source is (lab table > label > user);
  - agreeing scans;
  - passing the checks;
  - how recent it is;
  - users' correction rate.
- **Duplicates:** name and brand matching plus nutrient similarity flag
  likely duplicates. They're merged automatically above a high threshold and
  queued for review below it, with a simple review list on the backend.
- **Trust in the app:** verified entries are labelled in search, and the
  user sees the share of their logs that are verified ("92% of this week's
  logs are verified").

## 8.3 Regional depth where searches miss (week 3)

- **Choosing regions:** the "search misses by country" measure, from Phase
  5's search events, picks the one or two regions with the most misses.
- **For each region:**
  - import its open national or FAO regional table, after confirming its
    licence (decision 3);
  - typical dishes as recipes, so a plate of a local dish has real nutrients
    and scales with portion size;
  - local names in the region's languages (`FoodName`);
  - local portion units as `FoodServing` rows, such as a "wrap" of swallow,
    a "katori" or a "fist".
- **Contributions:** users in those regions are prompted more often to add
  products and dishes, and the region gets reviewers who know its foods.

```prisma
// Dishes as recipes of other foods
model FoodComponent {
  dishId       String
  ingredientId String
  grams        Float  // per 100 g of the dish
  @@id([dishId, ingredientId])
  @@map("food_components")
}
```

**Exit for Phase 8:**
- **Contributions:** a product added on one phone is found on another after
  verification, and the checks catch a hand-made bad entry.
- **Duplicates:** merges keep every barcode.
- **Regions:** the first region's dishes, names and units work end to end in
  search and Smart log.

---

# Phase 9 — ML and research (about 5 weeks)

**Difficulty: high.** Test sets, models and statistics, each with a gate it
has to pass before it switches on. Several parts need real data: weeks of
weigh-ins, workouts and cycle data from Phases 5–8.

**Depends on:**
- Phase 7's database;
- Phase 8's regional dishes, for the test set;
- Phase 6's health import and workouts, for the fitness models.

All training is in Python, in a new `ml/` folder with its own README, pinned
requirements and data download scripts. Models are exported to ONNX and run
in the backend with `onnxruntime-node`, or their outputs are precomputed
into the database. There's no new service to host.

## 9.1 Evaluation first (week 1)

- **Test sets:**
  - held-out foods, split by product **and** by brand, so near-duplicates
    can't leak between training and test;
  - 500 Smart log item names labelled by hand, taken from real meal
    descriptions. At least 100 are dishes from Phase 8's regions, so accuracy
    is measured where global apps are weakest.
- **Baselines:**
  - the category median;
  - the nearest food by name in FoodData Central;
  - today's behaviour, the model's own estimate.
- **Reports:** a script, `ml/eval.py`, prints every model's results against
  the baselines. It runs in CI on a small sample.

A model ships only if it beats every baseline on its test set.

## 9.2 Nutrition models (weeks 2–4)

1. **Name matcher:** maps "fried egg on sourdough" or "chicken shawarma" to
   the right foods in the database.
   - **Candidates:** the top 50 from Postgres search, plus a text-embedding
     search. Embeddings are stored with `pgvector`, from a small open model
     (e5-small through ONNX) or an Azure embeddings deployment.
   - **Reranker:** a small cross-encoder, trained on FNDDS's links from
     survey foods to ingredients, synonym pairs and users' Smart log
     corrections.
   - **Gate:** top-1 accuracy at least 75% and top-5 at least 92% on the
     hand-labelled set, ahead of plain search.
2. **Portion defaults:** realistic default grams for Smart log and search.
   - **Data:** portion weights from FNDDS, plus the median amount eaten per
     food and meal from NHANES dietary recalls.
   - **Output:** precomputed into `FoodServing` with `typical = true`.
   - **Gate:** closer to the true grams than the model's own guesses.
3. **Micronutrient estimator:** fills in what labels leave out, in three
   layers.
   1. **Fortification detector:** finds added nutrients in the ingredient
      list ("ferrous fumarate", "cholecalciferol"). Typical levels by
      category are learned from products that declare them.
   2. **Recipe reconstruction:** ingredient proportions are solved from the
      list order plus the label's macros (constrained least squares, starting
      from Open Food Facts' percentage estimates). Micronutrients are then
      the sum over the ingredients' FoodData Central values.
   3. **Correction model:** gradient boosting that predicts a range, to
      correct processing losses such as vitamin C in cooked foods.
   - **Rules:** measured and label values always win. Estimates are stored
     as `basis = estimated` with a low–high range, and shown as "≈".
   - **Gate, per nutrient:** beats both baselines, has a median error at most
     25%, and calls "good source" correctly at least 85% of the time.
     Nutrients that fail stay hidden for that food.
4. **Public accuracy page:**
   - no competitor publishes accuracy figures; Google doesn't for its photo
     estimates;
   - a public page and an in-app "How accurate is GRIT?" screen show results
     on the hand-labelled set, by region;
   - updated with each model release.

## 9.3 Fitness and body models (week 5)

These need at least 4 weeks of real data per user, which Phases 5 and 6
start collecting.

1. **Personal burn calibration:**
   - compare the Phase 4 adaptive estimate of what a person actually burns
     with what their logged exercise claims, to get a personal **burn factor**
     ("your workouts burn about 75% of the estimate");
   - it adjusts earnback calories;
   - **limits:** it switches on after about 4 weeks of logs and weigh-ins, is
     capped between 0.6 and 1.2, and moves at most 0.05 a week;
   - **gate:** it must make the adaptive model's week-ahead weight prediction
     more accurate on held-out weeks.
2. **Cycle-aware weight trend:**
   - for users who log their cycle, water weight gained before a period
     (often 1–2 kg) is filtered out of the trend, so neither the burn factor
     nor the adaptive targets read it as fat gain;
   - **gate:** it must reduce trend error on held-out cycles without delaying
     real changes.
3. **Strength levels from OpenPowerlifting:**
   - **data:** about 3 million meet results, in the public domain;
   - **model:** smoothed quantile regression of squat, bench press and
     deadlift percentiles by sex, bodyweight and age;
   - **what users see:** "stronger than 62% of lifters at your bodyweight",
     with the caveat that it compares against people who compete, and only
     if the user turns it on;
   - **gate:** calibrated on held-out meets within ±3 points, and rising
     steadily with strength. Other lifts show one-rep max and progress only.

**Exit for Phase 9:**
- each model's report is committed in `ml/reports/`;
- the models that passed are switched on, and the ones that failed stay off;
- the public accuracy page is live;
- the backend's database tests cover estimated values and the burn factor.

---

## Decisions needed from you

| # | Decision | Needed by |
|---|---|---|
| 1 | **Supabase Pro** for the 2–4 GB of food data. A global launch needs the full import, and the research recommends it | Phase 7 |
| 2 | ~~Target countries~~ **Decided: global.** Regional depth is added where searches miss | — |
| 3 | **Licence review** by a lawyer: Open Food Facts under ODbL (Phase 7), and each national or FAO regional table before it's imported (Phase 8) | Phases 7 and 8 |
| 4 | **Restaurants:** not in these phases. Later, choose between a licensed API (FatSecret, Nutritionix, Edamam; check current pricing) and curated chain menus | Later |
| 5 | **Exercise media:** free-exercise-db's images to start. Videos would need licensing or your own filming | Phase 5 |
| 6 | **Two developers?** If so, Phases 6 and 7 run in parallel | Phase 6 |
| 7 | **Data consent:** four separate settings, all off by default, each with matching privacy policy wording. Under GDPR, health data needs explicit opt-in, and bundled consent isn't allowed | Phase 5 |
| 8 | **Lawyer review before launch** of the Phase 5 safety items: the US consumer health notice (including Washington's law), the GDPR impact assessment and EU/UK representatives, how the UK Online Safety Act applies to the feed, Texas age signals, and registration with Nigeria's data protection commission (NDPC) if GRIT has Nigerian users | Phase 5 |

## Risks

| Risk | Mitigation |
|---|---|
| Apple's free strength plans and Strava's logger make GRIT's logger look redundant | The logger must be the fastest (voice, offline, one tap), and its value is the link to nutrition and sleep, which those apps don't have |
| Health data reaches a third party by accident | Phase 5 audit, no third-party SDKs on health screens, server-side analytics only; re-checked on every release |
| Import size or speed | Only products with a name and calories; bulk `COPY` into staging tables; daily changes after the first import |
| Search gets slower on millions of rows | Trigram and full-text indexes, a country filter, cached popular queries; a dedicated search engine if needed |
| A licence problem surfaces | `FoodSource` keeps every row traceable, so one source can be removed cleanly |
| Regional data spreads effort thin | Only the top one or two regions by search misses at a time; each region's accuracy is measured before the next starts |
| Estimates look authoritative | Always marked "≈" with ranges; nutrients ship only after passing their gate |
| Set logging feels slower than a paper notebook | One tap to repeat last time's set; designed and timed on a real phone before Phase 6 ends |
| Strength percentiles discourage beginners | Off unless the user turns them on; framed against competitive lifters, with progress over time as the main view |
| Burn calibration swings with noisy data | On only after 4 weeks; capped between 0.6 and 1.2; changes at most 0.05 a week |
| Phase 9 research takes longer than planned | Phases 5–8 ship value without it; each model switches on separately once it passes its gate |

## After Phase 9

These come from the research's later recommendations, renumbered to follow
on:

- **Phase 10, "Close the loop":**
  - a Recovery Context view, built on Phase 6's health data plus caffeine and
    alcohol;
  - Squads v2, with fair matchups and forgiving streaks;
  - a mood check-in with breathing sessions;
  - a GLP-1 companion, with muscle protection and support for stopping;
  - writing workouts back to the health apps.
- **Phase 11, "Reach and revenue":**
  - an endurance package: route import, fuelling and race-time predictions;
  - meal plans and grocery lists;
  - a hide-numbers mode;
  - cycle-aware coaching;
  - regional launches with local payments;
  - per-person portion calibration.
- **Phase 12, "Biomarkers and partners", after a lawyer signs off:**
  - blood pressure;
  - glucose-monitor meal responses;
  - a VO2max fitness age;
  - trend-only lab import;
  - insurer or employer pilots.

**Not planned:**
- restaurant data, until decision 4;
- photo portion models;
- camera rep counting;
- progression learned from GRIT's own data, which needs a few thousand
  logged sessions.
