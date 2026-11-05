# Phase 5 plan: GRIT's own food database and nutrition ML

**Goal:** the right food on the first search, with correct numbers,
including micronutrients, in the countries GRIT targets. GRIT should own
its food data and the models that keep it accurate, instead of asking Open
Food Facts live on every search.

**Duration:** about 9 weeks for one developer. 5A–5C are the database and the
product; 5D is the ML; 5E keeps the data growing and clean.

Background: [MARKET_RESEARCH.md](./MARKET_RESEARCH.md) and
[ROADMAP.md](./ROADMAP.md).

---

## What it builds on

- **Search and barcodes:** `FoodService.searchFoods` and `lookupBarcode`
  call Open Food Facts live, with a 10-minute in-memory cache.
- **Smart log** (`meal-parse`) grounds items in the user's `FoodMemory`
  first, then Open Food Facts for branded items, then a checked estimate.
  Generic foods (eggs, rice) always fall back to the estimate today.
- **Food logs** (`FoodLog`) store calories and macros only, with
  `servingQty`/`servingUnit`. There are no micronutrients anywhere yet.
- **User profiles** have `gender` and `dateOfBirth`, which is enough to pick
  each person's daily micronutrient targets.
- **The coach** already reads the week's averages; micronutrient gaps can
  join its context the same way.

## Success measures

Week 1 records a baseline for each against today's live search, so every
later change is measured against it.

| Measure | How | Target by end of phase |
|---|---|---|
| First-search success | Share of searches where the user picks a result without searching again | Beat baseline by 15 points |
| Barcode hit rate | Share of scans that find a product, per country | ≥ 90% US/UK, ≥ 80% EU |
| Verified share | Share of logs from measured or verified entries | ≥ 85% |
| Correction rate | Share of logged foods whose numbers the user edits | Halve the baseline |
| Micronutrient coverage | Share of a day's logged calories with a full micronutrient profile (measured or passed estimate) | ≥ 80% |
| Search speed | p95 time of `GET /food/search` | ≤ 300 ms |

The app starts recording search selections and corrections in week 1 (see
5B) so these can be measured.

---

## 5A. Data foundation (weeks 1–2)

### Schema

New tables, separate from the per-user ones. Values are stored per 100 g,
in standard units:

```prisma
// One food, however many products and sources describe it
model Food {
  id          String   @id @default(cuid())
  name        String
  brand       String?
  kind        String   // generic | branded | restaurant | user
  category    String?
  ingredients String?  // as printed, for branded foods
  countries   String[] // where it's sold, e.g. ["gb", "ng"]
  quality     Float    @default(0)   // 0–1, see 5E
  popularity  Int      @default(0)   // logs by GRIT users
  verified    Boolean  @default(false)
  updatedAt   DateTime @updatedAt

  barcodes  FoodBarcode[]
  servings  FoodServing[]
  nutrients FoodNutrient[]
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
  id     String @id @default(cuid())
  foodId String
  label  String
  grams  Float
  food   Food   @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@map("food_servings")
}

model FoodNutrient {
  foodId   String
  nutrient String  // code from the nutrient list below, e.g. "iron_mg"
  amount   Float   // per 100 g
  // measured | label | estimated
  basis    String
  low      Float?  // range, for estimates
  high     Float?
  food     Food    @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@id([foodId, nutrient])
  @@map("food_nutrients")
}

// Where each food came from, so values can be traced and refreshed
model FoodSource {
  id         String   @id @default(cuid())
  foodId     String
  source     String   // fdc | off | cofid | cnf | ciqual | fineli | fao_wa | user
  externalId String
  fetchedAt  DateTime
  food       Food     @relation(fields: [foodId], references: [id], onDelete: Cascade)
  @@unique([source, externalId])
  @@map("food_sources")
}
```

**Nutrients tracked:**
- **Energy and macros:** kcal, protein, carbs, sugars, fat, saturated fat,
  fibre, sodium.
- **Vitamins:** A, C, D, E, K, B1, B2, B3, B6, B12, folate.
- **Minerals:** calcium, iron, magnesium, potassium, zinc, phosphorus,
  selenium.

That's 26 codes, kept in one `nutrients.ts` list with units and display
names.

### Importers

Scripts in a new `packages/food-data/` package (TypeScript, run with
Node). Each one is idempotent: matched on `FoodSource(source, externalId)`,
so re-running it updates rows instead of duplicating them.

| Source | What | Licence | Notes |
|---|---|---|---|
| USDA FoodData Central: Foundation, SR Legacy, FNDDS | ~13k generic and survey foods, full panels, household portions | Public domain | FNDDS also links survey foods to SR ingredients, which the matcher in 5D trains on |
| USDA FoodData Central: Branded | ~400k US products | Public domain | Label nutrients only |
| Open Food Facts | ~3M products worldwide | **ODbL** | Only products with a name and calories; kept traceable through `FoodSource` |
| UK CoFID | UK foods | Open Government Licence | |
| Canada CNF, France CIQUAL, Finland Fineli | National foods | Open licences; confirm each | |
| FAO/INFOODS West Africa table | Jollof, egusi, garri, plantain and more | **FAO terms; confirm before use** | Coverage that MyFitnessPal lacks |

- **Duplicates:** same normalised barcode = same food. Name and brand matching
  waits for 5E.
- **Generic foods:** where several national tables list the same food, each
  is kept and tagged with its country, so search can prefer the user's
  country.
- **Refresh:** Open Food Facts publishes daily changes, imported by a
  scheduled job (a GitHub Action, or a Railway cron service).
  FoodData Central releases about twice a year; the importer re-runs on
  each release.

### Capacity (decision needed)

Filtered Open Food Facts plus everything else is roughly **2–4 GB**.
- Supabase's free plan allows 500 MB, so this needs **Supabase Pro** (8 GB
  included).
- The alternative is importing only products sold in the target countries.

**Exit:** all sources imported into a staging database; row counts and spot
checks recorded; a re-run changes nothing.

---

## 5B. Search, barcodes and Smart log on the new data (weeks 2–3)

- **Search:**
  - Postgres full-text plus trigram search (`pg_trgm`) over name, brand and
    synonyms.
  - Ranking, in order: the user's own foods (`FoodMemory`, favourites,
    recent), then foods sold in their country, then `quality`, then
    `popularity`.
  - Synonyms file to start: courgette = zucchini, aubergine = eggplant, and so
    on.
  - Move to Typesense or Meilisearch only if p95 stays over 300 ms.
- **Barcodes:** look up `FoodBarcode` locally, and fall back to Open Food
  Facts live. Anything found that way is saved, so the next scan is local.
- **API:** `GET /food/search` and `GET /food/barcode/:code` keep their shape
  for the current app and add `foodId`, `servings` and `nutrients`.
  `NormalizedFood` gains those fields as optional, so older app builds keep
  working.
- **Smart log:** generic items get matched to the database through the name
  matcher (5D); until it ships, top search result above a similarity
  threshold. The source order becomes memory → measured database →
  branded database → estimate.
- **Logging what users pick:** add a small `search_events` table (query,
  chosen `foodId` or none, position) and a correction flag on
  `FoodLog`. These feed the success measures and later model training.
- **Mobile:**
  - search results show serving choices ("1 slice (28 g)");
  - entries show "Verified" or "Unverified";
  - the log sheet lets you pick a serving instead of typing grams.

**Exit:** the app runs on the local database with no live Open Food Facts
calls except barcode misses; search p95 ≤ 300 ms with production data;
every earlier test suite passes.

---

## 5C. Micronutrient tracking in the app (weeks 3–4)

- **Storage:** `FoodLog.nutrients Json?`, the eaten amount's micronutrients
  saved at log time as `{ iron_mg: { amount, basis } }`. A snapshot, so later
  database fixes don't silently change past days. Smart log and search fill
  it; manual entries leave it empty.
- **Targets:** daily values by age and sex from the US Dietary Reference
  Intakes (a public NIH table), as `common/dri.ts`. A UK/EU option can come
  later.
- **API:**
  - `GET /nutrients/day?date=`: totals against targets, how much of the
    day's calories have micronutrient data, and which values are estimates;
  - `GET /nutrients/week`: nutrients that were low on most logged days.
- **App:**
  - a **Nutrients** view, opened from the Food tab's macro card: bars per
    nutrient, with estimated values marked "≈" and a coverage note ("Based
    on 82% of today's calories");
  - a "Often low this week" card on Stats.
- **Coach:**
  - often-low nutrients join its context, so it can suggest foods that fit
    the user's diet, for example vegan B12 sources;
  - a new check-in rule fires when the same nutrient is low 5 of the last 7
    logged days.
- **Wording:** "low", "good source" and "estimated", never "deficient" or
  anything diagnostic.

**Exit:** a day logged from verified foods shows totals that match a hand
calculation; estimated values are always marked.

---

## 5D. ML (weeks 3–7)

All training is in Python, in a new `ml/` folder with its own `README`,
pinned requirements and data download scripts. Models are exported to
**ONNX** and run in the backend with `onnxruntime-node`, or their outputs are
precomputed into the database. No new service to host.

### Evaluation first (week 3)

Before any model:
- **Test sets:**
  - held-out foods, split by product **and** by brand, so near-duplicates
    can't leak between training and test;
  - 500 Smart log item names labelled by hand, taken from real meal
    descriptions.
- **Baselines:**
  - the category median;
  - the nearest food by name in FoodData Central;
  - today's behaviour, the model's own estimate.
- **Reports:** a script, `ml/eval.py`, prints every model's results against
  the baselines. It runs in CI on a small sample.

A model ships only if it beats every baseline on its test set.

### 1. Name matcher

**Job:** map "fried egg on sourdough" or "chicken shawarma" to the right
foods in the database.

- **Candidates:** the top 50 from Postgres search, plus a text-embedding
  search. Embeddings are stored with `pgvector` on Supabase, from a small
  open model (e5-small, run through ONNX) or an Azure embeddings deployment.
- **Reranker:** a small cross-encoder that picks the best match.
  - It trains on FNDDS's links from survey foods to ingredients, plus
    synonym pairs.
  - After launch it also trains on users' Smart log corrections.
- **Gate:** top-1 accuracy ≥ 75% and top-5 ≥ 92% on the hand-labelled set,
  ahead of plain search.

### 2. Portion defaults

**Job:** realistic default grams for Smart log and search.

- Portion weights from FNDDS, plus the median amount eaten per food and meal
  from NHANES dietary recalls.
- Precomputed into `FoodServing`, with a "typical" flag.
- Later, after Phase 5, these become the population starting point for
  per-person calibration.
- **Gate:** on the hand-labelled set, closer to the true grams than the
  model's own guesses.

### 3. Micronutrient estimator

**Job:** fill in the micronutrients that labels leave out. Three layers, as
designed in the research:

1. **Fortification detector:** finds added nutrients in the ingredient list
   ("ferrous fumarate", "cholecalciferol", "cyanocobalamin"). Typical levels
   by category are learned from branded products that do declare them.
2. **Recipe reconstruction:**
   - ingredient proportions are solved from the list order plus the label's
     macros, as a constrained least-squares problem;
   - Open Food Facts' own ingredient percentage estimates are the starting
     point;
   - micronutrients are then the sum over the ingredients' FoodData Central
     values.
3. **Correction model:** gradient boosting that predicts a range, to correct
   processing losses (vitamin C in cooked foods, for example).

- **Measured and label values always win;** estimates fill only the gaps.
- **Stored** as `basis = estimated` with a low–high range.
- **Gate, per nutrient:** beats both baselines, has a median error ≤ 25%,
  and calls "good source" correctly ≥ 85% of the time. Nutrients that fail
  stay hidden for that food.

**Exit for 5D:** each model's report is committed in `ml/reports/`; the models
that passed are switched on and the ones that failed stay off; prediction runs
for every food in the database; the backend's database tests cover reading
estimated values.

---

## 5E. Contributions and data quality (weeks 6–8)

- **Adding a missing product:**
  - **Flow:** after a barcode miss, the app offers "Add it": photograph the
    nutrition panel and the ingredients. Smart log's vision call reads both
    into a draft for the user to confirm.
  - **Automatic checks:** calories within 15% of 4·protein + 4·carbs + 9·fat;
    each nutrient within physical limits; serving size consistent with the
    per-100 g values.
  - **Verification:** a second user's scan that agrees marks it verified.
    Until then it shows as unverified, ranks lower, and is only visible to
    others after it passes the checks.
  - **Sharing back:** with the user's consent, the product is submitted to
    Open Food Facts through its write API.
- **Quality score** per food, from 0 to 1. It weighs:
  - how trustworthy the source is (lab table > label > user);
  - agreeing scans;
  - passing the checks;
  - how recent it is;
  - users' correction rate.
  Search ranking uses it.
- **Duplicates:** name and brand matching plus nutrient similarity flag
  likely duplicates. They're merged automatically above a high threshold and
  queued for review below it, with a simple review list on the backend.
- **Abuse:** submissions are rate-limited and can be reported, and a food with
  repeated corrections drops out of search until it's reviewed.

**Exit:** a product added on one phone is found on another after
verification; the checks catch a hand-made bad entry; duplicate merges keep
every barcode.

---

## 5F. Verify and release (week 9)

- **Migrations:**
  - the new tables are additive;
  - `FoodLog.nutrients` is nullable;
  - the large import runs before the app release, so search never points at
    an empty table.
- **Tests:**
  - database tests for search ranking, barcode fallback, nutrient
    snapshots, contribution checks and merges;
  - unit tests for daily targets and the checks;
  - the ML evaluation runs in CI on a sample.
- **End to end:**
  - Smart log, search, barcode and the Nutrients view, in the web build and
    on a development build;
  - live checks against the production data.
- **Docs:**
  - ROADMAP, README (new tables and endpoints) and `ml/README`;
  - the data sources and their licences in `docs/DATA_SOURCES.md`, with the
    attributions the licences require shown in the app's About screen.

---

## Decisions needed from you

1. **Supabase plan:** Pro for the 2–4 GB of food data, or only import
   products sold in the target countries.
2. **Target countries** for the first release. This sets which national
   tables matter, how search ranks results, and the barcode targets.
3. **Licensing review:**
   - how GRIT uses Open Food Facts under ODbL;
   - the FAO West Africa table's terms for commercial use.
   Have a lawyer confirm both.
4. **Restaurants:** not in Phase 5. Choose later between a licensed API
   (FatSecret, Nutritionix, Edamam; check current pricing) and a curated set
   of chains' published menus.
5. **Data consent:** a setting ("Help improve GRIT's food data") that covers
   search and correction logging used for training and sharing additions
   with Open Food Facts, with matching privacy policy wording.

## Risks

| Risk | Mitigation |
|---|---|
| Import size or speed | Filter Open Food Facts by country and completeness; bulk `COPY` loads into staging tables; daily changes after the first import |
| Search gets slower on millions of rows | Trigram and full-text indexes, country filter, cached popular queries; a dedicated search engine if needed |
| Estimates look authoritative | Always marked "≈" with ranges; nutrients ship only after passing their gate |
| A licence problem surfaces | `FoodSource` keeps every row traceable, so one source can be removed cleanly |
| ML work takes longer than planned | 5A–5C ship value without it: measured micronutrients for generic foods and labels. 5D models switch on one by one |

## Not in Phase 5

- Restaurant data.
- Per-person portion calibration, the check-in bandit and the
  water-weight explainer, which need GRIT's own usage data first.
- Photo portion models.
- Strength logging.
