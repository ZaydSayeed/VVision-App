## Code Quality, Complexity & Tech Debt

The codebase is competently written and internally consistent — a single design-system, one obvious convention for every screen, and a clean client/server boundary — but it carries the structural debt of a fast-moving solo/small-team product. The defining problem is **scale-by-copy-paste**: a 1,030-line `TodayScreen`, an 887-line `RootNavigator` that mixes navigation, push registration, deep-link parsing and a full urgent-alert UI in one file, and the `useMemo(() => StyleSheet.create({...}), [colors])` block duplicated across **48 files** (often 100–360 lines of near-identical card/header/section-label/modal styles per file). There is **no `tsc`, lint, or CI in the build pipeline at all** — Metro/Babel strip types, so any type error or dead import ships silently; this is the single highest-leverage gap because it removes the cheapest possible safety net from a healthcare app. Dead code is real but modest (`glassesMockData.ts` 294 LOC fully orphaned; `RoutineScreen.tsx` 436 LOC still mounted as a live tab despite CLAUDE.md declaring it removed). None of this is a blocker, but left unchecked it compounds: every new screen today costs ~150 lines of boilerplate and every refactor touches a 1,000-line file.

> **Correction to the brief:** The "14 pre-existing `tsc` errors" claim does **not** reproduce on the current `main` tree — `npx tsc --noEmit --strict` (TS 5.9.3, `strict: true` via `expo/tsconfig.base`) returns **0 errors**. The errors were likely fixed in this session's hardening PRs. The *structural* finding still stands and is arguably worse: because `tsc` never runs in the build, those 14 errors lived in committed code undetected — and the next 14 will too.

### System map — the six God components

| File | LOC | Responsibilities crammed in | What it should be |
|---|---|---|---|
| `src/screens/patient/TodayScreen.tsx` | 1,030 | greeting, hero card, mood check-in, caregiver notes, meds card, tasks card, notification slide-panel, add-task modal, edit-task modal, add-med modal, chooser sheet — 9 `useState` modals + ~330 lines of `StyleSheet` | A 150-line screen composing `<MedsCard>`, `<TasksCard>`, `<NotifPanel>`, `<AddItemModals>` |
| `src/navigation/RootNavigator.tsx` | 887 | routing, splash, onboarding gate, deep-link/invite parsing (2 effects), caregiver+patient push-token registration (2 effects, ~80 lines), urgent-alert overlay with 3 pulse animations, notif panel, header | Pure navigator (~120 LOC) + extracted `usePushRegistration`, `useInviteDeepLink`, `<UrgentAlertOverlay>` |
| `src/screens/caregiver/PatientDetailScreen.tsx` | 583 | — | — |
| `src/screens/patient/FacesScreen.tsx` | 613 | — | — |
| `src/components/SideDrawer.tsx` | 593 | — | — |
| `src/components/VisionSheet.tsx` | 588 | consent gate, keyboard tracking, pan-gesture snap, chat list, input bar, ~210 lines of style | Split consent screen + chat into 2 components |

### Duplication inventory (ranked by payoff)

| Pattern | Occurrences | Est. duplicated LOC | Fix |
|---|---|---|---|
| `useMemo(() => StyleSheet.create({...}), [colors])` wrapper | **48 files** | ~200 (the boilerplate) | `useThemedStyles(factory)` hook |
| Card / header / section-label / pill / modal-sheet style blocks | ~20+ screens | ~1,500–2,500 | shared `cardStyles(colors)`, reuse existing `<SectionHeader>` |
| Help-alert state mutation routes (`dismiss`/`resolve`/`acknowledge`) | 3 routes, 1 file | ~90 | one `updateAlert` helper |
| Optimistic toggle handlers (`toggleComplete`/`toggleTaken`/`toggleTaken`-style) | ~4 hooks | ~120 | generic `useOptimisticToggle` |
| Add/Edit modal JSX in `TodayScreen` (task/edit-task/med) | 3 blocks | ~120 | one `<ItemFormModal>` |
| Vision FAB (LinearGradient + Ionicons) | 2 copies in `RootNavigator` (lines 330, 649) | ~30 | `<VisionFab>` component |

---

### Before / after — high-value simplification #1: `useThemedStyles`

Every one of 48 screens repeats this ceremony, and forgetting the `[colors]` dep silently breaks dark mode:

```tsx
// BEFORE — in 48 files
const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  /* ...80–360 lines... */
}), [colors]);
```

```tsx
// AFTER — src/hooks/useThemedStyles.ts (write once)
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: AppColors) => T
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
}

// in each screen
const styles = useThemedStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bg },
  /* ... */
}));
```
**Win:** removes the repeated `useMemo`/`useTheme`/dep-array boilerplate (~3–5 lines × 48 ≈ **150–200 LOC**) and makes the dark-mode dep array impossible to forget. Mechanical, low-risk.

### Before / after — high-value simplification #2: collapse the 3 help-alert routes

`dismiss`, `resolve`, and `acknowledge` in `helpAlerts.ts` are the same shape: `ObjectId.isValid` guard → scoped `updateOne` → re-fetch → `alertOut`.

```ts
// AFTER — one helper
async function applyAlertUpdate(req, res, filter: object, updates: object) {
  if (!ObjectId.isValid(String(req.params.alertId)))
    return void res.status(400).json({ detail: "Invalid ID" });
  const db = getDb();
  const _id = new ObjectId(String(req.params.alertId));
  const r = await db.collection("help_alerts").updateOne(
    { _id, patient_id: req.patientId!, ...filter }, { $set: updates });
  if (!r.matchedCount) return void res.status(404).json({ detail: "Not found or already closed" });
  const doc = await db.collection("help_alerts").findOne({ _id });
  res.json(alertOut(doc));
}
```
Each route becomes a 1-line call. **Win:** ~60–90 LOC and one place to get the `patient_id`/closed-state scoping right.

---

### [CQ-1] No `tsc` / lint / CI in the build — type errors and dead imports ship silently
**Severity:** High · **Effort:** Small
- **Issue / root cause:** `package.json` has no `typecheck` or `lint` script and there are no `.github/workflows`. Metro/Babel only strip types — they never check them. `tsconfig.json` sets `strict: true`, so the safety exists but is never invoked. The brief's "14 committed type errors" is direct proof the gap let real errors through (they're gone now, but nothing prevents the next batch). For a healthcare app this is the cheapest missing guardrail.
- **Recommendation / refactor:** Add `"typecheck": "tsc --noEmit"` + ESLint, and a minimal GitHub Action running `npm run typecheck && npm test` on PR. Gate merges on it. ~1 hour of work.
- **Evidence:** `package.json` scripts (no `tsc`/`lint`/`typecheck`); no `.github/workflows`; `tsconfig.json` (`strict: true`).

### [CQ-2] `TodayScreen.tsx` is a 1,030-line God component
**Severity:** High · **Effort:** Large
- **Issue / root cause:** One function owns 9 modal/panel states, three add/edit forms, two progress cards, a slide-out notification panel, and a ~330-line `StyleSheet`. The Tasks card even duplicates an IIFE computing `allItems`/`doneItems` twice (lines 803–823 and 870–884). Hard to test, hard to change safely, every edit risks unrelated UI.
- **Recommendation / refactor:** Extract `<MedsCard>`, `<TasksCard>`, `<NotificationPanel>`, and a single reusable `<ItemFormModal>` (replaces add-task/edit-task/add-med). Lift `allItems`/`doneItems` to one `useMemo`. Target: screen drops to ~150–200 LOC; net ~−400 LOC after dedup.
- **Evidence:** `src/screens/patient/TodayScreen.tsx:1-1030`; duplicated stat IIFE at `:803-823` and `:870-884`; three near-identical modals at `:924-970, :997-1027`.

### [CQ-3] `RootNavigator.tsx` mixes navigation with push, deep-links, and a full alert UI
**Severity:** High · **Effort:** Large
- **Issue / root cause:** 887 lines spanning routing, splash/onboarding gating, two ~40-line push-token registration effects (caregiver `:170-216`, patient `:219-248`) that differ only in role/endpoint, cold-start + foreground invite deep-link parsing (`:122-145`), and a 3-ring animated urgent-alert overlay with its own 120-line stylesheet (`:469-586, :708-777`). The Vision FAB is even duplicated inline (`:330-334` and `:649-665`).
- **Recommendation / refactor:** Extract `usePushRegistration(role)` (unifies both effects), `useInviteDeepLink()`, `<UrgentAlertOverlay>`, and `<VisionFab>`. Navigator shrinks to ~120 LOC; net ~−300 LOC and far easier to reason about routing.
- **Evidence:** `src/navigation/RootNavigator.tsx:170-248` (dup push effects), `:122-145` (deep-link), `:469-586`+`:708-777` (overlay), `:330-334`+`:649-665` (dup FAB).

### [CQ-4] `useMemo(StyleSheet.create, [colors])` duplicated across 48 files
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** Mandated by CLAUDE.md for dark mode, but copy-pasted verbatim into 48 files. Beyond boilerplate, it's a correctness footgun — omitting `[colors]` silently breaks dark mode with no warning (no lint rule catches it).
- **Recommendation / refactor:** Introduce `useThemedStyles(factory)` (see sketch #1). Migrate incrementally. Removes ~150–200 LOC and the dep-array footgun.
- **Evidence:** 48 files match `useMemo(() => StyleSheet.create`; e.g. `TodayScreen.tsx:217-551`, `RootNavigator.tsx:250-267`+`:469-586`, `VisionSheet.tsx:171-377`.

### [CQ-5] Repeated card/header/section-label/modal style blocks instead of shared style helpers
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** The same card (`borderRadius: radius.xl`, violet shadow, 4px accent), section-label (11px uppercase letterSpacing 1.2 muted), pill, and bottom-sheet modal styles are redefined in ~20+ screens. A `<SectionHeader>` shared component already exists but is not used everywhere. Changing the card look means editing dozens of files.
- **Recommendation / refactor:** Add `src/config/styles.ts` exporting `card(colors)`, `sectionLabel(colors)`, `pill(colors)`, `modalSheet(colors)` factories; adopt the existing `<SectionHeader>`. Conservatively ~1,500 LOC of duplicated style objects collapse.
- **Evidence:** `TodayScreen.tsx:319-518` (note/full-card/modal styles) vs identical patterns in `RootNavigator.tsx:495-515`, `VisionSheet.tsx:223-271`; unused-everywhere `src/components/shared/SectionHeader.tsx`.

### [CQ-6] Dead code: `glassesMockData.ts` (294 LOC) fully orphaned; other removed components linger in git but file remains
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `src/data/glassesMockData.ts` (294 LOC) has **0** import references anywhere in `src`. It ships in the bundle and confuses readers about whether glasses data is real. (Several other components — `StatChip`, `AmbientHearts`, `GradientHeader`, `CheckRow`, etc. — are already deleted in the working tree per `git status`, confirming an in-progress cleanup; finish it.)
- **Recommendation / refactor:** Delete `glassesMockData.ts`. Add a `ts-prune`/`knip` step (or the CI from CQ-1) to catch future orphans automatically.
- **Evidence:** `grep -rE "from ['\"].*glassesMockData['\"]" src` → 0 hits; file present at `src/data/glassesMockData.ts` (294 LOC).

### [CQ-7] `RoutineScreen.tsx` (436 LOC) is documented as removed but is a live tab — doc/code drift
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** CLAUDE.md states "Old screens `RoutineScreen.tsx` and `MedsScreen.tsx` still exist… but are no longer in navigation — their content was merged into `TodayScreen.tsx`." In reality `PatientTabNavigator.tsx:10,134` still imports and mounts `RoutineScreen` as the live "Routine" tab. So either the doc is wrong (patients see a duplicate, supposedly-dead screen) or the nav was never updated. Either way it's a 436-LOC trust hazard. (`MedsScreen.tsx` has 0 refs and *is* dead.)
- **Recommendation / refactor:** Decide intent: if merged into Today, remove the tab and delete `RoutineScreen.tsx`; if still wanted, fix CLAUDE.md. Delete the genuinely-dead `MedsScreen.tsx`.
- **Evidence:** `src/navigation/PatientTabNavigator.tsx:10` + `:134` (live import/mount); `RoutineScreen.tsx` 436 LOC; `MedsScreen` → 0 import refs.

### [CQ-8] ~150 `console.*` statements, no structured logging, ~129 on the server with occasional PII
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** 150 `console.log/warn/error` in `src`, 129 of them server-side, with no log levels, no redaction, and no crash reporting (Sentry only appears in comments). Several server logs include identifiers/PII context — e.g. `dailySummary.ts:105` logs `patientId`, `auth.ts:97` logs a Supabase email-fetch failure. On a healthcare backend, plaintext PII in logs is a compliance smell.
- **Recommendation / refactor:** Replace with a thin `logger` (pino) exposing `info/warn/error` + redaction of id/email fields; wire the already-referenced Sentry on client `ErrorBoundary` and server error handler. Strip client `console.log` in production via Babel `transform-remove-console`.
- **Evidence:** `grep -rc console.*` → 150 (`src`), 129 (`server-*`); `src/server-jobs/dailySummary.ts:105`, `src/server-routes/auth.ts:97`, `src/server-routes/reports.ts:213`.

### [CQ-9] Three help-alert mutation routes are near-identical
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** `dismiss` (`:78-104`), `resolve` (`:113-152`), `acknowledge` (`:157-199`) in `helpAlerts.ts` repeat the same validate→scoped-update→refetch→`alertOut` skeleton, so the security-critical `patient_id` scoping and closed-state guard are written three times.
- **Recommendation / refactor:** Extract one `applyAlertUpdate(req, res, filter, updates)` helper (sketch #2). ~60–90 LOC removed; one place to audit alert authorization.
- **Evidence:** `src/server-routes/helpAlerts.ts:78-104, 113-152, 157-199`.

### [CQ-10] Zero React-Native component/hook tests; the largest, riskiest files are untested
**Severity:** Medium · **Effort:** Large
- **Issue / root cause:** ~142 vitest tests cover backend/pure logic only. The God components (TodayScreen, RootNavigator, VisionSheet) and every hook (`useRoutine`, `useHelpAlert`, optimistic toggles, the urgent-alert escalation logic) have no tests — exactly the code most likely to regress during the refactors above.
- **Recommendation / refactor:** Add `@testing-library/react-native` + jest-expo; start with the safety-critical paths (help-alert send/ack/escalation, optimistic toggle rollback). Pairs naturally with extracting components in CQ-2/CQ-3 (small units are testable).
- **Evidence:** test runner is vitest backend-only (`package.json` `test`); no RN test deps; God files `TodayScreen.tsx`/`RootNavigator.tsx`/`VisionSheet.tsx` have no co-located tests.
