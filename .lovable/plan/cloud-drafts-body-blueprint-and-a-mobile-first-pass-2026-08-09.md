# Cloud drafts, Body Blueprint, and a mobile-first pass

Three things: your unsent chat text follows you across devices, a new "Blueprint" section covers training and style for your frame, and every screen gets tightened for phones.

## 1. Cloud-synced chat drafts

Today your meals, water, weight and gym logs already save to the cloud the moment they're logged — the only thing living on this device is the message you're halfway through typing. That moves to the cloud.

- Draft saves automatically as you type (debounced ~800ms), so it survives refresh, navigation, closing the tab, and signing in on your phone.
- A small status line under the composer: "Saving…" / "Saved" / "Saved on device (offline)".
- Local storage stays as an instant fallback; whichever draft is newer wins when you land on the chat page.
- Draft clears everywhere once the message is sent.

## 2. Blueprint — training + style for your body type

A new "Blueprint" page in the nav, built from your onboarding profile (height, weight, goal weight, goal, gym days). Curated content that's instantly there, with an AI "For you" block on top that refreshes from your latest numbers and progress.

**Your frame**
- Body-type read (ectomorph / lean / recomp) from BMI, weight vs goal weight, and rate of gain.
- Key measurements card: weight, BMI, waist-to-weight — the numbers that tell you if the gain is lean.

**Gym**
- A split matched to your gym days (3/4/5 day), compound-first, with rep ranges and progression rule ("add reps until top of range, then add weight").
- Ectomorph-specific guidance: limit cardio, longer rest, prioritise heavy compounds, sleep and recovery targets.
- Gear checklist: shoes, belt, straps, shaker, tape measure — what actually matters early vs later.
- Pre/post-workout timing tips tied to your existing calorie and protein targets.

**Style**
- Cuts and fits that read fuller on a slim frame: shoulder-line, sleeve length, layering, trouser break.
- Fabrics and patterns that add visual weight, and what to avoid.
- A short "what to buy first" list, adapted for Dhaka weather (breathable layering).

**AI "For you"**
- One generated block at the top: 3-5 specific actions based on your current surplus, protein average, training days logged and weight trend. Regenerates on demand and caches so it doesn't re-run on every visit.

## 3. Mobile-friendly pass across the site

- Diary: date navigation, calorie ring, macro bars and meal cards reflow to a single column with comfortable tap targets; the calendar picker opens as a bottom sheet on phones.
- Chat: composer pinned above the keyboard, safe-area padding, messages full-width, suggestion cards scroll horizontally.
- Dashboard/Progress: charts get mobile heights and fewer axis labels; stat grids go 1-2 columns.
- Onboarding: full-width fields, larger inputs, sticky next button.
- Nav: bottom tab bar on phones (Chat, Diary, Blueprint, Progress), top bar on desktop.
- Every header row with text + controls uses the grid/min-w-0/shrink-0 pattern so nothing clips at 320px.

## Technical notes

- New `chat_drafts` table (one row per user: content, updated_at) with RLS scoped to `auth.uid()` and grants for `authenticated` + `service_role`; upsert via a `saveChatDraft` server function, read via `getChatDraft`.
- New `blueprint_insights` table caching the AI "For you" block (content, generated_at) per user, RLS-scoped.
- Blueprint route at `src/routes/_authenticated/blueprint.tsx`; curated content in `src/lib/blueprint.ts` (pure data + body-type classifier), AI block via a new `getBlueprintInsight` server fn calling the AI gateway with the same profile/progress data the coach already uses.
- Responsive work stays in JSX/Tailwind classes; nav split into desktop bar + mobile bottom tabs in `app-shell.tsx`.
