# Design System — Restaurant IQ 2.0

## Product Context
- **What this is:** decision brain for independent restaurants; turns Qloo taste intelligence into testable, costed opportunities.
- **Who it's for:** owner-operators (1–5 locations), judges, future POS partners. Mobile-first operators.
- **Project type:** web app (consumer-grade operator tool, Toast / DoorDash Merchant feel) + short marketing landing.
- **Source of truth for brand:** `RestaurantIQ Brand Identity Guide v1.0 (Feb 2026)` — colors and type below are taken from it.

## Aesthetic Direction
- **Direction:** Clean consumer-grade cards. White surfaces, generous whitespace, few words, one warm accent.
- **Decoration level:** minimal. No gradients, no icon-in-colored-circle grids, no decorative blobs, no emoji in product UI (icons are line icons).
- **Mood:** calm, confident, appetizing. Looks like a tool a busy owner opens between lunch and dinner service.
- **Information strategy:** every screen shows at most one headline, one number, three chips per card. Explanations live one tap away (side sheet / bottom drawer, info popovers). Nothing is hidden, nothing is shouted.

## Typography (brand guide)
- **Display / Headings:** Plus Jakarta Sans 700–800, tight tracking (-0.02em).
- **Body / UI:** Plus Jakarta Sans 400/500/600.
- **Chinese:** Noto Sans SC 400/700 (loaded only for `zh`).
- **Numbers:** Plus Jakarta Sans with `font-variant-numeric: tabular-nums`.
- **Loading:** `next/font/google` (self-hosted at build).
- **Scale:** 12 / 13 / 14 (body) / 16 / 18 / 22 / 28 / 36 / 48 px; line-height 1.2 headings, 1.5 body.

## Color (brand guide)
- **Approach:** restrained. White is the stage; coral is the only action color; navy is ink and structure.
- **Primary (actions, active nav, progress):** Coral `#FF6B35`; soft `#FFEFE7`; pressed `#E85A25`.
- **Secondary / ink:** Deep Navy `#1B2A4A` (headings, primary buttons on white, sidebar brand). Rich Black `#0D0D15` reserved for dark surfaces.
- **Neutrals:** `#FFFFFF`, 50 `#F9FAFB`, 100 `#F3F4F6`, 200 `#E5E7EB`, 400 `#9CA3AF`, 600 `#4B5563`, 900 `#111827`.
- **Semantic:** success Emerald `#10B981` (soft `#E6F7F1`), warning Amber `#FF9F1C` (soft `#FFF3E0`), info Blue `#3B82F6` (soft `#EAF2FF`), danger `#DC2626` (soft `#FDECEC`), gold `#D4A843` for "pursued".
- **Charts:** sequential = coral ramp; diverging = Blue `#3B82F6` (positive) / Coral `#FF6B35` (negative) with neutral-200 midpoint; status colors never reused as series.
- **Dark mode:** not shipped for the hackathon (light-only, brand "white-first" ask). Tokens are CSS variables so it can be added later.

## Spacing & Layout
- **Base unit:** 4px. Density: comfortable. Card padding 20px (16 on mobile). Section gap 24px.
- **Layout:** desktop = 240px left rail + content (max 1120px) + optional 480px side sheet. Mobile (<1024px) = bottom tab bar (5 tabs), sheets become bottom drawers.
- **Radius:** card 16px, chip/button 12px (pill 999px for chips), input 10px.
- **Elevation:** cards `0 1px 2px rgba(17,24,39,.04)` + 1px neutral-200 border; sheets `-12px 0 40px rgba(17,24,39,.12)`.

## Components
- **Card:** white, border neutral-200, radius 16. Title (18/700), one-line meta (14/400, gray-600), chip row, one hero number (28/800), 1–2 buttons.
- **Chip:** pill, 12.5px/600. Variants: neutral, coral-soft (Qloo delta), success-soft, warning-soft, danger-soft. Taste chip carries a 14px conic ring showing affinity 0–1.
- **Buttons:** primary = navy on white (`#1B2A4A` → text white); accent = coral (primary decision actions: Pursue, Run); secondary = neutral-100.
- **Step bar:** 5 pills (Snapshot · Signals · Choose · Decide · Act); done = success, current = coral.
- **Side sheet / drawer:** segmented control (Why · Numbers · Plan). Footer with Pursue / Reject.
- **Info popover:** 16px "i" ring next to any term; tap reveals a 1–2 sentence definition (e.g. affinity ≠ demand).
- **Data pill:** "Sample data · 5 sources" opens the Trust & data drawer.

## Motion
- minimal-functional. Sheet slide 200ms ease-out; chip count-up none; respects `prefers-reduced-motion`.

## Copy voice
- Owner-to-owner. Short. "3 ideas worth testing." "Why this one?" "Nothing here is a forecast."
- Never: "leverage", "unlock", "revolutionize", "AI-powered" in product UI.

## Localization
- EN / 中文 / ES. UI and generated content both localized via keyed templates (`src/i18n`). Locale cookie `riq_locale`; switcher in the rail / bottom tab overflow.

## Decisions Log
| Date | Decision | Rationale |
|---|---|---|
| 2026-10-24 | Replaced blue-SaaS card grid + ledger exploration with brand-guide card system | Owner: "Toast/DoorDash style, cards, few words"; brand guide supplies palette + type |
| 2026-10-24 | Light-only for submission | Owner: main UI white; time-boxed |
