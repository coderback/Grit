# food-data

Importers for GRIT's own food database (plan Phase 7.1): USDA FoodData
Central, Open Food Facts and the UK's CoFID, written into the `foods`,
`food_nutrients`, `food_servings`, `food_barcodes`, `food_names` and
`food_sources` tables that the backend's migrations create. Values are per
100 g in the 28 nutrient codes of `packages/backend/src/food/nutrients.ts`.

```sh
npm run import -w packages/food-data -- <source> [options]
npm run import -w packages/food-data -- --help
```

## Sources

| Source                       | Reads                                                                                         | Keyed by (`food_sources.externalId`)                        | Licence                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `fdc` Foundation + SR Legacy | Foundation **JSON** zip (the 2026-10-29 CSV zip is missing its food files), SR Legacy CSV zip | `ndb:<NDB number>`: one food per NDB from both datasets     | Public domain (CC0)                                     |
| `fdc` FNDDS                  | Survey **JSON** zip (the CSV's `nutrient_id` holds nutrient numbers)                          | `fndds:<food code>`                                         | Public domain                                           |
| `fdc` Branded                | Branded CSV zip (431 MB; 2.0M rows, 26M nutrient rows), streamed                              | `branded:<GTIN-13>` (`branded:fdc<id>` without a GTIN)      | Public domain                                           |
| `off`                        | the JSONL export (default, streamed: about 13 GB gzip) or `--file` the CSV export             | the OFF code, as OFF writes it                              | **ODbL** (database), DbCL (contents), CC BY-SA (images) |
| `off-delta`                  | OFF's daily delta files (JSONL), since the last import                                        | the OFF code                                                | ODbL                                                    |
| `cofid`                      | McCance and Widdowson's CoFID 2021 workbook (checked by SHA-256)                              | the food code (`13-669~<name>` for the one code used twice) | Open Government Licence v3.0                            |

CNF (Canada), CIQUAL (France) and Fineli (Finland) aren't written yet: their
files couldn't be downloaded here, and the importers will be built from the
real files.

### USDA FoodData Central

- **Stable keys.** USDA gives a revised food a new `fdc_id`; the NDB number,
  FNDDS food code and GTIN don't change, so a new release updates foods in
  place instead of adding duplicates.
- **Foundation + SR Legacy are one import.** 212 Foundation foods re-analyse
  an SR Legacy food with the same NDB number. Each NDB becomes one food:
  Foundation's name, category and values where it has them, SR's for the
  rest (Foundation has no folate DFE, caffeine or alcohol, and no energy for
  oils), both lists of servings, and SR's older wording as another name.
  `--dataset sr` or `foundation` alone imports both.
- **Nutrients** by FDC nutrient id, first present wins: energy 1008 → 2048
  (Atwater specific) → 2047; carbs by difference 1005 (slightly negative
  values on fatty meats clamped to 0) → 1050; sugars 2000 → 1063; fat 1004 →
  1085; fibre 1079 → 2033; vitamin A as RAE (1106) only, never IU; folate as
  DFE (1190) only, never total folate; vitamin D 1114, else IU (1110) ×
  0.025 (Branded labels); niacin 1167 (preformed).
- **Servings**, labelled without their weight (the app adds "(28 g)"):
  Foundation "1 cup, chopped" with the RACC as the typical "1 serving"; SR
  "1/2 cup"; FNDDS "1 cup" with "Quantity not specified" as the typical
  "1 serving" and guideline amounts ("per cup of hot cereal") left out;
  Branded the household serving ("1 ONZ" → "1 oz", "Amount per serving" →
  "1 serving"). Otherwise the first portion is typical.
- **Branded**: 8-digit codes are UPC-E (expanded to UPC-A first); a code
  failing its check digit keeps the product but no barcode; USDA lists a
  product again when it's updated (390k GTINs appear more than once), so
  each GTIN's latest publication wins; brand is `brand_name` or else
  `brand_owner`; values per 100 ml for drinks are taken as per 100 g.
  `branded_food.csv`, `food.csv` and `food_nutrient.csv` share one food order
  (not sorted by id), so they're joined as streams: one pass to find each
  GTIN's latest version, a second to write. Memory stays under about 1 GB.
- Kind: `generic`, FNDDS mixed dishes (WWEIA 3002–3808) `dish`, Branded
  `branded`. Basis `measured` (Branded `label`), verified, country `us`,
  quality 1 (Branded 0.8). `fetchedAt` is the release date, so re-runs of a
  release change nothing.
- The newest release of each dataset is found on USDA's download page
  (falling back to the releases current on 2026-11-06). Releases: Foundation
  and Branded twice a year (April and October/December), FNDDS every two
  years, SR Legacy never (2018-04 is final).

### Open Food Facts

- All OFF data goes through `offRecord` in
  `packages/backend/src/food/off-product.ts`, the mapping the backend's
  barcode lookup uses too. It reads both of OFF's shapes: schema 1004
  (`nutrition.aggregated_set`, in the JSONL export and the deltas), keeping
  label values only (`packaging`, `manufacturer`), never OFF's estimates from
  ingredients; and the legacy `nutriments` keys.
- **The JSONL export is the bulk path.** The CSV export can't tell OFF's
  estimates from label values, so from the CSV only energy, macros, sugars,
  saturated fat, fibre, sodium, caffeine and alcohol are read.
- **Filters**: `--min-scans N` (`unique_scans_n`), `--countries gb,us`.
  Products need a name and calories (`cleanRecord`); supplements, obsolete
  products and codes that aren't 8–14 digits are left out.
- **Deltas** (`off-delta`): OFF publishes one file a day of every product
  changed that day (same documents as the export) and keeps 14 days. The
  importer reads `index.txt` and imports the files after the newest
  `fetchedAt` (a product's `last_modified_t`) already in the database, less
  two days (`--overlap-days`), since products saved live by the barcode
  lookup can be newer than the last delta; re-reading is harmless. `--since
<unix seconds>` overrides it. With `--only-existing` only products already
  in the database are updated (for a small database). A product that has
  become obsolete loses its OFF row, and its food when nothing else
  describes it. Deltas never report deleted products: a monthly full import
  with `--full` removes them.
- Liquids are per 100 ml in OFF, taken as per 100 g (density 1, as OFF does).

### UK CoFID

- The 2021 workbook (the latest; the "old foods" file isn't imported).
  Sheets are found by table number (1.3 Proximates, 1.4 Inorganics, 1.5
  Vitamins), columns by their acronym in header row 2, and the sheets joined
  by row (checked by code and name).
- "Tr" (a trace) is 0; "N" (present, amount unknown) and blanks are
  missing; numbers may use a decimal comma.
- Carbs are CoFID's available carbohydrate (it excludes fibre; USDA's
  includes it), fibre AOAC else NSP, vitamin A as retinol + β-carotene
  equivalents / 12 (RAE), niacin preformed (`NIAC`, not niacin equivalents,
  to match USDA and labels), folate total (CoFID has no DFE), vitamin E as
  α-tocopherol equivalents. No caffeine column. Alcoholic drinks are per
  100 ml, taken as per 100 g.
- 2,887 foods, 2,854 with energy. Country `gb`, kind `generic`, measured,
  verified, quality 1, no servings (CoFID has no portions), `fetchedAt` the
  release date (2021-03-19).

## Options

| Option                                                                 |                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--file <path>`                                                        | a local file instead of downloading (repeatable for `fdc`; the dataset is told by USDA's file name)                                                                                                                                                                                                                    |
| `--dir <path>`                                                         | a folder of local files: USDA's or CoFID's files by name, or OFF delta files                                                                                                                                                                                                                                           |
| `--dataset <list>`                                                     | `fdc`: `foundation,sr,fndds,branded` (default `foundation,sr,fndds`)                                                                                                                                                                                                                                                   |
| `--limit <n>`                                                          | stop after n records: a sample                                                                                                                                                                                                                                                                                         |
| `--dry-run`                                                            | run everything in transactions that are rolled back, and report what would change                                                                                                                                                                                                                                      |
| `--full`                                                               | after a complete import, remove this dataset's rows the source no longer lists, and the foods only they described. Scoped by `externalId` prefix (`ndb:`, `fndds:`, `branded:`), so one dataset's full import never removes another's. Refused with `--limit`, filters or `--only-existing`, and when nothing was read |
| `--max-remove <n>`                                                     | with `--full`, refuse to remove more than n rows (default 10% of the dataset, at least 100), so a truncated file can't empty a dataset                                                                                                                                                                                 |
| `--batch <n>`                                                          | records per transaction (default 2000)                                                                                                                                                                                                                                                                                 |
| `--refresh`                                                            | download again even when cached                                                                                                                                                                                                                                                                                        |
| `--min-scans`, `--countries`, `--only-existing`, `--format jsonl\|csv` | `off`, `off-delta`                                                                                                                                                                                                                                                                                                     |
| `--since`, `--overlap-days`                                            | `off-delta`                                                                                                                                                                                                                                                                                                            |

Paths are taken relative to where npm was run. The importer prints progress
every few seconds and the final counts (as a line and as JSON), and exits
non-zero on any error.

## Environment

- **`DIRECT_URL`**, else `DATABASE_URL`: the database to import into.
  Imports use `COPY` into temporary tables and one transaction per batch,
  which need a session: on Supabase, use the direct connection
  (`db.<ref>.supabase.co:5432`) or the session pooler (port **5432** on
  `pooler.supabase.com`). **Not** the transaction pooler on port 6543 that
  the API's `DATABASE_URL` uses: temporary tables don't survive between its
  transactions. GitHub's runners have no IPv6, so in Actions use the session
  pooler unless the project has the IPv4 add-on. `sslmode=require` is
  understood.
- `FOOD_DATA_CACHE`: where downloads are kept (default
  `packages/food-data/.cache`, git-ignored). Release files have their date or
  time range in the name, so a cached file is reused; `--refresh` downloads
  again. OFF's full export is streamed, not cached.
- Behind an HTTP proxy, set `NODE_USE_ENV_PROXY=1` (Node 22.21+) so `fetch`
  uses `HTTPS_PROXY`.

## How it writes

`src/writer.ts`: records are cleaned (`cleanRecord`: name and calories
required, implausible values dropped), copied into temporary tables with
`COPY` and merged with a few set-based statements per batch:

- a record is matched to its food by `(source, externalId)`, then by
  barcode (GTIN-13), so a product from USDA and OFF is one food;
- the best source's values are shown: government tables, then USDA
  Branded, then OFF; the others add barcodes, names and a source row;
- rows are only written when something changed, so **a second run of the
  same data changes nothing** (the final counts are all 0 apart from
  `read`/`skipped`), and a re-run after a failure picks up where it stopped.

## Sizes (measured locally)

Local Postgres 16, after importing everything below (`pg_total_relation_size`
of the six food tables, indexes included; per dataset from the per-row sizes):

| Imported                                             | Foods  | Nutrient rows | Size       | Time (first run / re-run)                                |
| ---------------------------------------------------- | ------ | ------------- | ---------- | -------------------------------------------------------- |
| `fdc` Foundation + SR Legacy                         | 7,970  | 198,085       | ≈ 42 MB    | 10 s / 9 s                                               |
| `fdc` FNDDS                                          | 5,431  | 152,063       | ≈ 35 MB    | 7 s / 6 s                                                |
| `cofid`                                              | 2,854  | 69,073        | ≈ 13 MB    | 5 s / 5 s                                                |
| `fdc --dataset branded --limit 5000` (sample)        | 4,941  | 51,244        | ≈ 15 MB    | 76 s / 77 s (70 s of it is the pass over the whole file) |
| `off --file products.csv.gz --min-scans 20` (sample) | 27,111 | 226,565       | ≈ 70 MB    | 2.5 min to read all 4.9M rows                            |
| **All food tables**                                  | 48,307 | 697,030       | **167 MB** |                                                          |

Per row: about 156 bytes per nutrient value, 650 per food, 275 per serving,
260 per source and 160 per barcode. So:

- **USDA generic foods + CoFID (about 16k foods, 90 MB) fit Supabase Free
  (500 MB)** next to the app's own data.
- **USDA Branded** in full: about 1.6M products (2.0M rows, 390k of them
  older versions) at about 3 KB each: **4–5 GB**.
- **Open Food Facts** in full: 2.7–3.7M products with a name and calories
  at about 2.5 KB each: **7–9 GB**. Filtered, e.g. `--min-scans 5` or
  `--countries gb,us`, it's a fraction of that.
- So everything is well over the plan's 2–4 GB and over Supabase Pro's
  included 8 GB disk. `food_nutrients` (one row per value) is two thirds of
  it; storing a food's values in one column would cut that several times.
  Decide before the full Branded and OFF imports.

## Refresh schedule

- **Open Food Facts**: daily, `off-delta --only-existing` from the GitHub
  Action `.github/workflows/food-data.yml` (07:43 UTC, after OFF's delta);
  drop `--only-existing` once the database holds the OFF import. Monthly, a
  full import with `--full` to remove products OFF deleted. If the daily job
  stops for more than 14 days, the deltas in between are gone: run a full
  import.
- **USDA**: after each release (Foundation and Branded in April and
  October/December; FNDDS every two years): `fdc` (and `fdc --dataset
branded`), then the same with `--full` to remove foods USDA dropped. The
  Action can run them by hand (Actions → Food data → Run workflow).
- **CoFID**: when gov.uk publishes a new edition (none since 2021); update
  `COFID_URL` and `COFID_SHA256` in `src/sources/cofid.ts`.

The Action needs a `DIRECT_URL` repository secret (Settings → Secrets and
variables → Actions); without it, it succeeds with a notice and imports
nothing.

## Licences and attribution

- **USDA FoodData Central**: public domain (CC0). Credit is appreciated:
  "U.S. Department of Agriculture, Agricultural Research Service.
  FoodData Central."
- **Open Food Facts**: the database is under the Open Database Licence
  (ODbL) 1.0, its contents under the Database Contents Licence 1.0 and its
  images under CC BY-SA. GRIT must credit Open Food Facts ("Contains data
  from Open Food Facts, available under the Open Database License", with a
  link) where the data appears. Merging OFF rows with other sources by
  barcode very likely makes GRIT's food tables a _derivative database_ under
  the ODbL's share-alike terms. **The plan requires a lawyer to confirm how
  GRIT uses OFF (decision 3) before the first production OFF import.**
  `food_sources (source = 'off')` keeps every OFF-derived row traceable and
  removable.
- **CoFID**: "Contains public sector information licensed under the Open
  Government Licence v3.0. Source: Public Health England (2021) McCance and
  Widdowson's The Composition of Foods Integrated Dataset."
- National tables to come (CNF, CIQUAL, Fineli): open licences, each to be
  confirmed.

## Tests

```sh
npm test                    # unit tests: each source's parser on real fixture rows
DATABASE_URL=postgresql://grit:grit@127.0.0.1:5432/grit npm run test:db
npm run lint && npm run typecheck
```

The database tests (`*.db-spec.ts`) need a database with the backend's
migrations applied. They work in copies of the food tables in a schema of
their own (`src/test-db.ts`), dropped afterwards, so they never read,
merge with or remove real imported foods. They import every fixture twice
(the second run must change nothing) and check the Foundation/SR merge,
scoped `--full` removals, obsolete OFF products and `--only-existing`.

`fixtures/` holds small cuts of the real files (under 400 KB in all):

- `fdc/`: 7 Foundation foods (JSON, fields the importer doesn't read
  removed), 10 SR Legacy foods (a zip laid out like USDA's), 4 FNDDS foods,
  and 19 Branded rows (two products listed twice, a UPC-E code, a bad check
  digit, vitamin D in IU), all public domain;
- `off/`: 13 delta products (schema 1004, cut to the fields the importer
  reads) and 11 rows of the CSV export: ODbL / DbCL, © Open Food Facts
  contributors, https://world.openfoodfacts.org;
- `cofid/`: 39 foods of three CoFID sheets as CSV (the tests build the
  workbook from them): Open Government Licence v3.0, source Public Health
  England (2021).
