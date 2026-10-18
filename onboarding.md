# GRIT App – Personalised Nutrition & Fitness Onboarding

## Overview
This onboarding flow is designed to:
- Maximise user conversion (delay login)
- Personalise fitness + nutrition plans
- Create immediate engagement and habit formation

---

## 0. Pre-Onboarding Hook
**Goal:** Reduce friction and increase completion rate

**Screen:**
- "Build your custom fitness & nutrition plan in 60 seconds"
- Progress bar (0% → 100%)

**Action:**
- Start onboarding (no login required)

---

## 1. Basic Information
**Goal:** Establish user baseline

**Inputs:**
- Gender
- Date of Birth (auto-calculates age)
- Height (cm)
- Weight (kg)

---

## 2. Activity Level
**Goal:** Estimate energy expenditure (TDEE)

**Question:**
- How many times do you workout per week?

**Options:**
- 0–1 → Sedentary
- 2–3 → Lightly active
- 4–5 → Active
- 6+ → Very active

---

## 3. Goal Definition
**Goal:** Identify user objective
age 
**Inputs:**
- Goal:
    - Lose weight
    - Build muscle
    - Maintain
    - Recomp
- Desired weight (kg)

---

## 4. Goal Pace Selection
**Goal:** Define speed of progress

**Options:**
- Slow (0.25 kg/week)
- Moderate (0.5 kg/week)
- Aggressive (1 kg/week)

**System Calculates:**
- Estimated timeline to goal
- Daily calorie target

---

## 5. Friction Identification
**Goal:** Personalise behavioural support

**Question:**
"What usually stops you from reaching your goal?"

**Options:**
- Lack of consistency
- No time
- Diet is too hard
- No motivation
- No clear plan

---

## 6. Nutrition Setup
**Goal:** Tailor diet approach

**Inputs:**
- Diet type:
    - None
    - Vegetarian
    - Vegan
    - Halal / Kosher
- Goal focus:
    - High protein
    - Balanced
    - Low carb
- What they aim to accomplish:
    - Fat loss
    - Muscle gain
    - Energy
    - Discipline

---

## 7. Advanced Preferences
**Goal:** Provide flexibility and control

**Toggles:**
- Add calories burned back to daily goal (Yes/No)
- Rollover extra calories to next day (Yes/No)

---

## 8. Notifications Setup
**Goal:** Enable habit reinforcement

**Options:**
- Workout reminders
- Meal reminders
- Progress nudges
- Streak alerts

**Advanced Option:**
- "Notify me only when I’m off track"

---

## 9. Plan Generation
**Goal:** Deliver immediate value

**Outputs:**
- Daily calorie target
- Macronutrient split (Protein / Carbs / Fats)
- Weekly weight projection
- Workout plan

---


## 10. Authentication (Post-Value)
**Goal:** Convert user after investment

**Options:**
- Sign up with Google
- Sign up with Apple
- Email registration

---

## Core Calculations

### Calorie Deficit Formula
Daily Calorie Deficit = (7700 × kg target per week) / 7


### Outputs Derived:
- TDEE (Total Daily Energy Expenditure)
- Adjusted calorie goal
- Estimated timeline

---

## Key Product Principles

- **Personalisation First** → Every input affects output
- **Low Friction** → No login until value is shown
- **Behavioural Design** → Identify and address user struggles
- **Immediate Reward** → Show plan instantly
- **Retention Hooks** → Streaks, reminders, social pressure

---