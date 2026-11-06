# Device testing checklist (Phases 5–7)

What to try on a real Android phone with the preview APK, and what a
correct result looks like. The automated tests and the browser can't check
these: the phone's keyboard, offline behaviour, and Health Connect.

Tick each box as you go. When something's wrong, note what you did, what you
expected, what happened, and the time, and take a screenshot. The time lets
the matching backend error be found in Railway's logs.

---

## 0. Before you start

- [ ] On expo.dev, the **preview** environment has `EXPO_PUBLIC_API_URL`
      set to `https://backend-production-70938.up.railway.app`, plus
      `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Railway is running the latest `main`:
      `https://backend-production-70938.up.railway.app/health` shows
      `"status":"ok"`.
- [ ] Build and install: `eas build --profile preview --platform android`,
      then open the link on the phone.
- [ ] On Android 13 or older, Health Connect is installed from the Play
      Store (Android 14 and later have it built in).
- [ ] Ideally, a watch or fitness app (Samsung Health, Fitbit, Google Fit,
      Garmin) already writes to Health Connect, so there's heart rate and
      sleep data to import. Without one, the health checks in section 6 still
      run, just with less data.
- [ ] For the feed check, a second account to follow yourself with.

---

## 1. Sign-up and safety (Phase 5)

- [ ] Create a new account through onboarding. The age picker starts at 18.
- [ ] Onboarding has a wellbeing question. Answering "yes" hides "Lose weight"
      on the goal screen.
- [ ] Your calorie target never goes below 1,200 kcal (1,500 for men),
      however fast a pace you pick.
- [ ] The first time you use an AI feature (Smart log, the coach, or building
      a plan), a sheet asks for permission and names Azure OpenAI. Tapping
      "Not now" means the feature doesn't run.
- [ ] Profile → Privacy has an AI switch. Turning it off stops
      AI features until you allow them again.
- [ ] The coach screen says it's an AI coach.

## 2. Food (Phase 5)

- [ ] Food tab: the drink chips (espresso, black tea, beer…) log caffeine or
      alcohol, and the day shows a caffeine and alcohol line.
- [ ] Smart log: "salmon and rice" asks "Cooked in oil or butter?". Picking
      "A little" adds about 45 kcal of oil.
- [ ] Smart log shows where each item came from (your foods, database, or
      estimate), and odd protein or fat numbers say "check this".
- [ ] The keyboard doesn't cover the text box in Smart log or the food
      search.

## 3. Exercise library and plan (Phase 5)

- [ ] Profile → Exercise library: searching "squat" and filtering by
      Barbell finds Barbell Squat; tapping it shows a picture and steps.
- [ ] Profile → What your coach knows: add "Sore left knee; avoid jumping".
      Then Plan → At a gym → Rebuild plan. The new plan has no squats, lunges
      or jumps.
- [ ] Tapping an exercise in the plan opens how to do it.

## 4. Strength workout (Phase 6)

**Starting**
- [ ] Home shows "Next up · Session 1 of N" with a Start workout button.
- [ ] Start workout opens the session's exercises, each with three or so set
      rows already filled in.

**Logging**
- [ ] Ticking ✓ on a row logs it in one tap. The row turns green and the
      phone gives a small buzz.
- [ ] A rest timer slides up at the bottom with a countdown, +30s and
      Skip. It's shorter after a warm-up set.
- [ ] With the app open, the phone buzzes when the rest ends.
- [ ] Typing a weight or reps works with the number keyboard, and the
      keyboard doesn't hide the row you're typing in, including the
      exercises at the bottom.
- [ ] Say it: type, or say with the keyboard's microphone, "bench 80 for 8,
      8, 7". Three bench sets are ticked at 80 kg.
- [ ] Say it with an odd phrasing, "did three sets of ten pull ups", also
      works. This one uses the AI, so it may ask for permission first.

**The ⋯ menu on an exercise**
- [ ] Superset with the next exercise: both cards get a teal border and
      "Superset A1 / A2". There's no rest timer between them, only after the
      second.
- [ ] Plates and warm-ups: for 100 kg it shows "Each side: 25 + 15". Add
      warm-up sets puts W rows at the top.
- [ ] Swap for a similar exercise lists the same movement (for example,
      other bench presses).
- [ ] Move up, Move down and Remove exercise do what they say.
- [ ] + Add exercise at the bottom: search and add one.

**Leaving and coming back**
- [ ] Press the home button mid-workout, open another app, and come back.
      The workout and its ticks are still there.
- [ ] Swipe GRIT away completely, then reopen it. Home shows "Workout in
      progress" with Resume workout, and nothing is lost.

**Finishing**
- [ ] Finish shows "Workout done 💪" with minutes, sets, volume and "✓ Saved".
- [ ] The Stats tab lists the workout under Workouts with its set count.
      Tapping it shows every set. Delete workout removes it.
- [ ] Home now shows "Next up · Session 2".

**Second time on the same lift** (same day is fine)
- [ ] The "LAST" column shows last time's sets. Tapping one logs it at those
      numbers in one tap.
- [ ] If you hit the top of the rep range on every set last time, the card
      says "↑ 82.5 kg × 8" (or similar), with "You hit 12 reps on every set
      last time…".
- [ ] Lifting more than ever before shows a "🏆 New PR" message straight away.
- [ ] Tapping the exercise name opens its history: Heaviest, a chart, and
      past sessions.

**Others' view**
- [ ] On your second account (following the first): the feed shows
      "completed Strength training · N sets" and "🏆 New personal record",
      with no weights.
- [ ] A "Workouts" challenge counts the workout.

## 5. Offline (Phase 6)

- [ ] Start a workout and tick a few sets, then turn on airplane mode.
      Ticking still works.
- [ ] Finish while in airplane mode. The summary says "Saved on your phone.
      It'll sync when you're back online", and the Stats tab says "waiting
      for a connection".
- [ ] Still offline, swipe GRIT away completely. Turn airplane mode off and
      open GRIT. Within about a minute the workout appears in the list,
      **once**, not twice.
- [ ] Starting a workout offline uses the targets from the last time you
      were online. On a brand-new install that has never been online, the
      targets may be blank; that's expected.

## 6. Health Connect (Phase 6): the riskiest part

**Connecting**
- [ ] Profile → Health Connect lists what GRIT reads and why.
- [ ] Turning on "Sync with Health Connect" opens Health Connect's
      permission screen, listing exercise, steps, distance, heart rate, heart
      rate variability, resting heart rate, respiratory rate, skin
      temperature, VO2max, weight, sleep and past data. Allow all.
- [ ] Back in GRIT, a message says "Synced: …".

**Checking the numbers** (compare with your fitness app or Health Connect
→ Data)
- [ ] "What's come in" shows each day's steps and sleep, matching the
      source app within a few percent.
- [ ] Workouts from your watch appear on the Stats tab with the right type,
      duration and calories.
- [ ] If your watch records them, the Recovery section shows resting heart
      rate and heart rate variability (marked RMSSD), matching the source app.
- [ ] Sync now a second time: "0 new workouts". The days count can still be
      above 0, since today's steps keep changing; that's fine.

**Cycle data**
- [ ] "Import cycle data" is off by default.
- [ ] Turning it on asks you to confirm, then asks Health Connect for
      menstruation permission. If there's period data, it says "N days
      stored".
- [ ] Turning it off says "Cycle data turned off and deleted".

**Writing meals**
- [ ] Turn on "Write meals to Health Connect" and allow nutrition.
- [ ] Log a food in GRIT. Health Connect → Data → Nutrition shows it, with
      calories, protein, carbs and fat.
- [ ] Edit its calories in GRIT; Health Connect shows the new number.
- [ ] Delete it in GRIT; it disappears from Health Connect.

**Refusing**
- [ ] Turn sync off and on again, this time denying some permissions. GRIT
      doesn't crash, and syncs what it was allowed.

## 7. Food database (Phase 7)

Needs the food data imported into Supabase first (the Food data workflow
for `fdc` and `cofid`; see ROADMAP).

**Search and logging**
- [ ] Food search waits for 3 letters. "banana" lists "Banana, raw" with
      "✓ Verified" and a serving, e.g. "1 serving (126 g) · 122 kcal".
- [ ] "yoghurt" finds yogurts, and "courgette" finds zucchini.
- [ ] Picking a result opens the sheet with serving chips ("1 slice
      (28 g)", "100 g", "Grams"). Two of a 28 g serving logs 56 g, and the
      calories match the sheet.
- [ ] "Grams" lets you type the grams directly.
- [ ] Logging the same food again from Quick add keeps its serving.

**Barcodes**
- [ ] Scan a packaged food you haven't scanned before: it opens with the
      product, its serving and calories. Scan it again: it opens faster
      (it's now in GRIT's database).
- [ ] A US product with a short barcode (UPC-E, 8 digits) is found.
- [ ] An unknown barcode offers "Log manually".

**Nutrients**
- [ ] The Food tab's macro card has "Nutrients ›". It opens today's
      vitamins and minerals with "Based on N% of today's calories" and
      "Today isn't over yet, so nothing is marked low until it is."
- [ ] Yesterday (‹) shows "Low" tags where something was low on a full
      day, and "Over the limit" for sodium on a salty day. Nothing says
      "deficient".
- [ ] After a few logged days with database foods, Stats shows "Often
      low this week" for anything low on most days; tapping opens
      Nutrients.
- [ ] Food data sources (from Nutrients or Profile) credits USDA, Open
      Food Facts and the UK's CoFID, with their licences and links.

**Smart log**
- [ ] "a banana and a boiled egg" reads both as "Food database ✓
      Verified", and logging them shows their vitamins on Nutrients.
- [ ] "cooked basmati rice" gets about 130 kcal per 100 g, not dry rice's
      360.

## 8. Everywhere

- [ ] Switch between light and dark (Profile → Account → Appearance); the
      workout screen and Health Connect screen are readable in both.
- [ ] No crash screens anywhere. If one appears, screenshot it and note
      what you tapped.

---

## Not expected to work yet

Don't report these; they're known and listed in `docs/ROADMAP.md`.
- The rest timer doesn't alert you when GRIT is in the background.
- Health data syncs only while GRIT is open (no background sync).
- "Say it" uses the keyboard's microphone, not GRIT's own speech recognition.
- Weight suggestions are in kg steps; for lb users they aren't rounded to
  5 lb plates.
- Water isn't written to Health Connect.
- Most packaged foods come from Open Food Facts live until its full
  import is done, so searching for a brand may take a second longer, and
  only scanned products carry their label's nutrients.
- Canadian, French and Finnish foods aren't in the database yet.

## iPhone (later)

The same checklist applies with Apple Health instead of Health Connect. It
needs a paid Apple Developer account and a development or TestFlight build.
Differences to expect:
- heart rate variability shows as SDNN (RMSSD only on newer iOS);
- sleeping temperature needs five nights of readings before it appears;
- iOS never says which permissions were refused, so GRIT just imports what
  it can.
