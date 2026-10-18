---
name: GRIT
description: A dark, high-contrast fitness and nutrition tracking app with a bold orange accent system and a premium athletic aesthetic.

colors:
  # Backgrounds — layered surfaces from deepest to lightest
  background:
    dark: "#0F0F0F"
    surface: "#1A1A1C"
    surface2: "#242428"
    surface3: "#2E2E33"

  # Text
  text:
    primary: "#F5F0EB"
    muted: "#9A9498"

  # Accent
  accent:
    primary: "#FF5C2B"        # orange — CTAs, active states, brand
    secondary: "#4B9FFF"      # blue — informational, secondary actions
    success: "#00C8A0"        # teal — completed states, streaks, success
    error: "#FF453A"          # red — destructive actions, errors

  # Borders
  border: "#2B2B30"

  # Tinted fills (alpha variants used in code as hex)
  fills:
    orange_faint: "#FF5C2B18"   # 9%  — icon container bg, card tint
    orange_dim:   "#FF5C2B2A"   # 16% — pressed danger bg
    orange_soft:  "#FF5C2B40"   # 25% — accent card border
    orange_mid:   "#FF5C2B55"   # 33% — avatar ring
    teal_faint:   "#00C8A022"   # 13% — teal icon container
    error_faint:  "#FF453A18"   # 9%  — logout button resting bg
    error_dim:    "#FF453A30"   # 19% — logout button pressed bg
    error_border: "#FF453A40"   # 25% — logout button border

typography:
  families:
    sans: "DM Sans"           # UI text — Regular (400), Medium (500), Bold (700)
    mono: "JetBrains Mono"    # Numeric data — Regular (400)

  weights:
    regular: 400
    medium: 500
    bold: 700

  scale:
    display_lg:
      size: 42
      weight: 700
      family: sans
      letter_spacing: -1
      usage: "Hero numbers — daily calorie total"
    display:
      size: 30
      weight: 700
      family: sans
      letter_spacing: -0.5
      usage: "Page titles (Profile), plan reveal headline"
    headline:
      size: 28
      weight: 700
      family: sans
      letter_spacing: -0.5
      usage: "Onboarding section titles"
    title_lg:
      size: 26
      weight: 700
      family: sans
      letter_spacing: -0.5
      usage: "Stat card primary values"
    title:
      size: 24
      weight: 700
      family: sans
      letter_spacing: 0
      usage: "Screen sub-headers (Social)"
    card_title:
      size: 16
      weight: 700
      family: sans
      letter_spacing: 0
      usage: "Card headings"
    body_lg:
      size: 16
      weight: 400
      family: sans
      letter_spacing: 0
      usage: "Input text, primary body"
    body:
      size: 15
      weight: 400
      family: sans
      letter_spacing: 0
      usage: "Secondary body, list items"
    label:
      size: 13
      weight: 500
      family: sans
      letter_spacing: 0
      usage: "Descriptive labels, tab text, captions"
    caption:
      size: 12
      weight: 400
      family: sans
      letter_spacing: 0
      usage: "Supporting text, brand names in food log"
    overline:
      size: 12
      weight: 500
      family: sans
      letter_spacing: 0.8
      text_transform: uppercase
      usage: "Section labels, input field labels"
    micro:
      size: 10
      weight: 500
      family: sans
      letter_spacing: 0.6
      text_transform: uppercase
      usage: "Stat card labels, tab bar labels"
    mono_body:
      size: 15
      weight: 400
      family: mono
      usage: "Calorie values in food log items"
    mono_sm:
      size: 11
      weight: 400
      family: mono
      usage: "Challenge card stats"
    mono_label:
      size: 10
      weight: 400
      family: mono
      usage: "Bar chart day labels"

spacing:
  # Base unit: 1pt — values are informal multiples of 4
  scale:
    "2":  2
    "3":  3
    "4":  4
    "6":  6
    "8":  8
    "10": 10
    "12": 12
    "14": 14
    "16": 16
    "18": 18
    "20": 20
    "24": 24
    "28": 28
    "32": 32

  # Named semantic values
  page_padding: 20
  page_padding_profile: 24
  section_gap: 24
  card_gap: 16
  item_gap: 12
  inner_gap: 8
  tight_gap: 6
  tab_bar_clearance: 100    # paddingBottom for screens with floating tab bar
  tab_bar_clearance_lg: 140 # profile screen (more content near bottom)

radii:
  pill: 999
  card: 20
  card_sm: 16
  input: 16
  icon_container: 12
  icon_container_sm: 8
  badge: 8
  bar: 6
  progress: 999
  dot: 2

borders:
  default:
    width: 1
    color: "#2B2B30"
  emphasis:
    width: 1.5
    color: "#2B2B30"
  accent:
    width: 1.5
    color: "#FF5C2B"
  success:
    width: 1.5
    color: "#00C8A0"
  input_focus:
    width: 1.5
    color: "#FF5C2B"
  input_error:
    width: 1.5
    color: "#FF453A"

elevation:
  floating_tab_bar:
    ios:
      shadow_color: "#000000"
      shadow_offset_x: 0
      shadow_offset_y: 6
      shadow_opacity: 0.35
      shadow_radius: 12
    android:
      elevation: 12

opacity:
  pressed: 0.85
  pressed_strong: 0.7
  disabled: 0.5

components:
  button:
    height: 52
    radius: 999
    padding_horizontal: 20
    font_family: sans
    font_size: 16
    font_weight: 700
    letter_spacing: 0.2
    variants:
      primary: { background: "#FF5C2B", text: "#FFFFFF" }
      secondary: { background: "transparent", border: "#FF5C2B", text: "#FF5C2B" }
      ghost: { background: "transparent", text: "#9A9498" }

  input:
    height: 52
    radius: 16
    border_width: 1.5
    padding_horizontal: 16
    background: "#242428"
    font_family: sans
    font_size: 16
    font_weight: 400
    label_font_size: 13
    label_font_weight: 500
    error_font_size: 12
    states:
      default: { border_color: "#2B2B30" }
      focused: { border_color: "#FF5C2B" }
      error:   { border_color: "#FF453A" }

  card:
    radius: 20
    background: "#1A1A1C"
    border_width: 1
    border_color: "#2B2B30"
    padding: 20

  card_sm:
    radius: 16
    background: "#242428"
    border_width: 1
    border_color: "#2B2B30"
    padding: 16

  floating_tab_bar:
    position: absolute
    bottom: 20
    side_inset: 16
    background: "#1A1A1C"
    radius: 999
    padding_vertical: 10
    padding_horizontal: 6
    border_width: 1
    border_color: "#2B2B30"
    icon_size: 22
    label_font_size: 10
    label_font_weight: 500
    indicator_dot_size: 4
    indicator_dot_radius: 2
    active_color: "#FF5C2B"
    inactive_color: "#9A9498"

  progress_bar:
    height: 6
    radius: 999
    background: "#242428"
    fill: "#FF5C2B"

  onboarding_progress_bar:
    height: 3
    radius: 2
    background: "#242428"
    fill: "#FF5C2B"

  avatar:
    size: 60
    radius: 30
    background: "#FF5C2B18"
    border_width: 2
    border_color: "#FF5C2B55"
    font_size: 22
    font_weight: 700

  settings_row:
    radius: 16
    border_width: 1
    border_color: "#2B2B30"
    padding_horizontal: 16
    padding_vertical: 16
    gap: 14
    background_default: "#242428"
    background_pressed: "#2E2E33"
    icon_container_size: 40
    icon_container_radius: 12
    chevron_box_size: 28
    chevron_box_radius: 8
    chevron_box_background: "#2E2E33"

  segment_control:
    background: "#242428"
    radius: 999
    padding: 3
    gap: 2
    tab_radius: 999
    tab_padding_vertical: 9
    tab_font_size: 13
    active_background: "#2E2E33"
    active_font_weight: 700
    inactive_background: "transparent"
    inactive_font_weight: 400
---

# GRIT — Design System

## Brand Identity

GRIT is a fitness and nutrition tracking app built around the idea of earned results. The visual language is deliberately raw and assertive — a **deep matte black canvas** shot through with **charged orange** highlights. It's the aesthetic of a chalk-dusted weight room: no gloss, no gradients, just clarity and intent.

The name "GRIT" appears in orange wherever it anchors a header — a wordmark that doubles as a status indicator. You're in the app, you're committed, you're working.

---

## Color System

### Surfaces — Layered Depth

Four near-black tones create depth without shadows on content:

| Token | Hex | Role |
|---|---|---|
| `dark` | `#0F0F0F` | Screen background |
| `surface` | `#1A1A1C` | Primary cards, tab bar |
| `surface2` | `#242428` | Inputs, secondary cards, settings rows |
| `surface3` | `#2E2E33` | Pressed states, active segment tabs, chevron boxes |

Each step up in surface brightness signals interactivity or content nesting — the user instinctively reads depth from these layers.

### Accent — Orange as Action

`#FF5C2B` (vivid reddish-orange) is the **only warm color** in the entire palette. Every tap target, every CTA, every active indicator uses it. This creates an immediate and consistent visual grammar: orange means "this does something" or "this is your goal number." It never appears decoratively.

When orange is used as a tinted fill (icon container backgrounds, card borders), the alpha value is always low enough — 18% to 55% — to read as a _hint_ of orange rather than a full color block.

### Status Colors

- **Teal `#00C8A0`** — completion, streaks, success. Used on habit cards when a habit is done for the day; on challenge cards at 100%; on calorie surplus/deficit indicators.
- **Blue `#4B9FFF`** — secondary informational. Notification-type icons on the profile screen.
- **Error `#FF453A`** — destructive actions only. The log-out button background is a barely-there `#FF453A18` that deepens to `#FF453A30` on press, ensuring the destructive intent is legible without being alarming at rest.

### Text

`#F5F0EB` — slightly warm off-white, never pure white. This keeps text from harshly popping against the near-black backgrounds. `#9A9498` is the muted gray used for secondary labels, placeholders, and captions — it reads as "this is supporting information" without disappearing.

---

## Typography

### Font Families

**DM Sans** handles all UI text. It's a geometric humanist sans-serif that sits cleanly on dark backgrounds and stays legible at small sizes. Three weights are loaded: Regular (400), Medium (500), Bold (700). SemiBold is intentionally not used — the jump between Medium and Bold is the hierarchy.

**JetBrains Mono** is reserved for numeric data in context — calorie counts in the food log, challenge statistics — where monospace alignment signals precision and helps the user parse values at a glance.

### Weight as Hierarchy

The weight scale is binary in practice: **Bold** for anything the user needs to read first (titles, numbers, CTA labels), **Medium** for interactive or labeled text (settings rows, section headers, tab labels), **Regular** for descriptive body copy.

### Letter Spacing Conventions

- **Tight** (`-0.5` to `-1`): Large display numbers and page titles — the weight of these elements is already strong; tighter tracking makes them feel more deliberate
- **Normal** (`0`): Body text and medium-sized labels
- **Open** (`+0.6` to `+1`): `uppercase` overlines and section labels — extra space compensates for all-caps optical compression

### The Overline Pattern

Section headers, input field labels, and card sub-headers consistently use:

```
fontFamily: 'DMSans-Medium'
fontSize: 12–13
textTransform: uppercase
letterSpacing: 0.8
color: Colors.muted
```

This creates a quiet but clear categorisation layer — the text announces what's below it without competing for attention.

---

## Spatial System

### Base Grid

The layout uses an informal 4pt base — most values are multiples of 4. The most common spacing tokens in practice are **6, 8, 12, 16, 20, 24**.

### Page Container

Screens use `padding: 20` on the scroll container. Profile uses `padding: 24` because it's a denser information layout. The bottom of every scrollable screen carries `paddingBottom: 100–140` to ensure the last item clears the floating tab bar.

### Gap Hierarchy

| Value | Role |
|---|---|
| 2–3 | Within tight text groups (label + sub-label) |
| 6 | Greeting line pairs, tight label/value pairs |
| 8–10 | Within cards — icon to text, stat value to stat label |
| 12–14 | Between items in a list |
| 16–20 | Between cards within a section |
| 24 | Between major sections on a screen |

---

## Component Language

### Cards

The primary container unit is a **card** — `borderRadius: 20`, a 1pt `#2B2B30` border, and a `#1A1A1C` background. Cards never use box shadows internally; the border alone provides legibility against the near-black screen background.

Smaller cards (settings rows, food log items, activity log items) use `borderRadius: 16`. The size of the radius signals hierarchy — larger radii for more prominent cards.

When a card represents a **completed or active state** (a finished habit, an in-progress challenge), the border upgrades from default `#2B2B30` to a 1.5pt colored border — teal for completion, orange for selection. This is the primary "selected" affordance across the entire app.

### Buttons

All primary action buttons are **pill-shaped** (`borderRadius: 999`), height 52pt, DM Sans Bold at 16pt. The orange background with white text is the only primary button style. Secondary buttons use a transparent background with an orange border and orange text — the shape is identical so the user never has to learn a new tap target size.

The CTA at the bottom of screens is full-width, making it impossible to miss and easy to tap with a thumb.

### Inputs

Inputs share the same 52pt height as buttons, creating a consistent horizontal rhythm on forms. Background is `surface2` (`#242428`), slightly lifted from the screen background. On focus, the 1.5pt border switches to orange — the same orange used everywhere else, reinforcing "this is where you act."

### Icon Containers

Icons in settings rows and informational cards always sit inside a tinted square container (`borderRadius: 12`). The container background is always the icon's color at 12–13% opacity. This makes icon color legible without making the container dominant.

### Floating Tab Bar

The tab bar floats `20pt` above the bottom edge, inset `16pt` from each side, with `borderRadius: 999`. This creates a floating pill above the home indicator. The drop shadow (`shadowOpacity: 0.35, height: 6, radius: 12`) is the only use of shadow in the entire app — reserved for the element that must always float above content.

Active tabs show an orange indicator dot (4×4pt, `borderRadius: 2`) below the icon. Inactive tabs use `Colors.muted`. There is no background highlight on the active tab itself — the dot and color change are sufficient.

### Progress Bars

Progress bars are thin (6pt height), fully rounded (`borderRadius: 999`), with an orange fill on a `surface2` track. Onboarding progress bars are even thinner (3pt) and stretch across the full width at the top of each step screen — they function as a step counter, not a loading indicator.

### Segment Controls

Used on the Social screen to switch between feed views. A pill container with `surface2` background holds inner tabs with `borderRadius: 999`; the active tab gets a `surface3` background and Bold weight text. This is a fully custom implementation — no native component used.

---

## States and Interaction

### Press Feedback

Across the app, interactive surfaces use `opacity` for press feedback via React Native's `Pressable`. Standard cards and CTAs use `opacity: 0.85` pressed, smaller buttons use `opacity: 0.7`. Disabled elements use `opacity: 0.5`.

### Active / Complete State

The two-state border pattern — neutral border at rest, colored border when active or complete — is the dominant interaction pattern. It's quiet in a list but immediately legible when scanning. No background fill change is required; the border alone carries the signal.

### Dangerous Actions

The log-out button and destructive actions use the error color (`#FF453A`) as a low-opacity background fill (18% at rest, 30% on press), with a 25% opacity border. The icon and label render in the error color. The pattern makes the button look "different" without being alarming — it earns attention rather than demanding it.

---

## Visual Hierarchy — Reading Order

On any screen, the visual reading order is:

1. **Orange** — the primary call to action or the most important number
2. **Off-white bold text** — titles and values the user needs to act on
3. **Off-white regular text** — detail and supporting information
4. **Muted gray** — labels, captions, secondary metadata
5. **Teal** — positive status indicators (completion, success)
6. **Border edges** — structural containers read last

This hierarchy is maintained by color and weight alone — no drop shadow hierarchy, no background gradient, no illustration. The app earns its premium feel through restraint.

---

## Onboarding — Design Considerations

The onboarding flow uses the same color system but introduces **overline + large-text heading** pairings at the top of each screen:

```
[muted overline — step context or screen label]
[off-white bold 28–30pt — the question or instruction]
[muted regular 15pt — supporting explanation]
```

Selection cards in onboarding are full-width with the same `borderRadius: 20` as home cards. Selected state: `borderColor: Colors.orange, borderWidth: 1.5`. This mirrors the habit/challenge completion pattern but in orange rather than teal — it means "chosen" rather than "done."

The progress bar at the top of each step is 3pt tall, spanning full width. It is a wayfinding indicator, not a loading bar — intentionally unobtrusive, just enough to communicate "you are here."
