# Health Graph Overhaul — Design Spec
**Date:** 2026-05-05
**Status:** Approved

## Scope

Fix health data accuracy and graph UX in the patient Health tab:

1. **Wrong numbers** — sync overwrites samples instead of aggregating
2. **All timeframes show same line** — data is sparse (single upserted value per day)
3. **1d graph broken** — daily granularity gives one point, useless for intraday
4. **No axis labels** — y-axis hidden, x-axis labels too small/wrong format
5. **No scrubbing** — can't drag to see value at a point in time

---

## Root Cause Analysis

### Why numbers are wrong
The sync uses `$set: { value: r.value }` with `(patientId, metric, date)` as the upsert key. HealthKit sends multiple samples per day (hourly step counts, per-minute heart rate, etc.). Each sample overwrites the previous — the final stored value is whichever sample synced last, not the daily total.

### Why 1d is broken / all timeframes look the same
`patient_health_readings` stores one document per `(patientId, metric, date)` — daily granularity only. For `1d` range the query returns today's single value → one point → no line. For `7d`/`30d`/`90d`, if data was only synced recently, there may only be 1–2 days of data → same flat line regardless of range.

---

## Data Model Fix

### Change sync aggregation (`src/server-routes/health.ts`)

Instead of `$set: { value }`, use metric-appropriate aggregation:

| Metric | Aggregation | Rationale |
|---|---|---|
| `steps` | `$max` | HealthKit cumulative daily total — take the highest value seen |
| `active_minutes` | `$max` | Same — cumulative daily total |
| `heart_rate` | running average via `$inc` count + `$inc` sum, compute avg at read | HR samples are individual, need mean |
| `sleep` | `$max` | Take longest sleep value seen for the date |

**Simpler approach (recommended):** For `steps` and `active_minutes`, use `$max` (HealthKit sends cumulative daily totals, so the largest value is the correct total). For `heart_rate`, store individual samples as separate documents (no upsert — just insert) and average them at query time. For `sleep`, `$max`.

**heart_rate storage change:** Remove the upsert-by-date for heart rate. Instead, insert each sample with a `recordedAt: ISO timestamp` field. The summary and trend queries average them.

This requires a small schema split: non-HR metrics keep `(patientId, metric, date)` upsert. HR metrics use `(patientId, metric, recordedAt)` with no upsert.

The sync endpoint detects `metric === "heart_rate"` and uses `insertOne` (with duplicate protection via a unique index on `(patientId, metric, recordedAt)`) instead of `updateOne/upsert`.

**Reading type change:** Add `recordedAt?: string` (ISO timestamp) to the `Reading` type in `src/api/health.ts` and `src/services/healthkit.ts`. For HR samples, HealthKit returns `startDate` — use that as `recordedAt`. Non-HR metrics leave `recordedAt` undefined and continue to use `date: YYYY-MM-DD` upsert.

### Summary endpoint fix (`GET /health/summary`)

- Steps: `find({ patientId, metric: "steps", date: today })` → take `.value` (already `$max` aggregated)
- Heart rate: `find({ patientId, metric: "heart_rate", recordedAt: { $gte: startOfToday } })` → average `.value` across all today's samples
- Active minutes: same as steps
- Sleep: same as steps

### Trend endpoint fix (`GET /health/trends`)

For `7d`, `30d`, `90d`:
- Steps/active/sleep: group by date, return one point per day (already stored that way)
- Heart rate: group by date, average all samples for each day → one point per day

For `1d`:
- Steps: group by hour — but steps are stored as daily cumulative totals, so 1d shows today's single total. **Simplification:** for `1d`, return a single data point (today's total) labeled "Today". The chart renders a single bar or a prominent number instead of a line.
- Heart rate: group by hour using `recordedAt` → returns hourly average HR for today → shows intraday curve

---

## Graph Component Fix (`ExpandableMetricCard.tsx`)

### 1d special case
When `range === "1d"` and metric is `steps`/`active_minutes`/`sleep`: don't render the line chart. Show a large centered number with unit (the single data point value). The chart area shows "Today's total: X steps."

When `range === "1d"` and metric is `heart_rate`: render the line chart with hourly points, x-axis labels as `"6AM"`, `"12PM"`, `"6PM"`.

### Axis labels

**Y-axis:** Enable y-axis with min/max labels. Show the min value at bottom and max at top.
- Pass `yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}` and remove `hideYAxisText`
- Use `maxValue` and `mostNegativeValue` computed from `chartData`
- Show only 3 y-axis labels: min, mid, max

**X-axis labels:**
- `7d`: show day labels `"Mon"`, `"Tue"` etc.
- `30d`: show every 5th date label
- `90d`: show every 2-week label
- `1d` (HR): show `"6AM"`, `"12PM"`, `"6PM"`, `"Now"`

Label formatting done in `useMemo` that transforms `points` → `chartData` with correct `label` values per range.

### Scrubbing (`pointerConfig`)

`react-native-gifted-charts` `LineChart` supports pointer/crosshair via `pointerConfig` prop:

```typescript
pointerConfig={{
  pointerStripHeight: chartHeight,
  pointerStripColor: colors.muted + "44",
  pointerStripWidth: 1.5,
  pointerColor: accentColor,
  radius: 5,
  pointerLabelWidth: 80,
  pointerLabelHeight: 36,
  activatePointersOnLongPress: false,
  autoAdjustPointerLabelPosition: true,
  pointerLabelComponent: (items: any[]) => (
    <View style={tooltipStyle}>
      <Text style={tooltipValueStyle}>{items[0]?.value}</Text>
      <Text style={tooltipLabelStyle}>{items[0]?.label}</Text>
    </View>
  ),
}}
```

This gives a draggable crosshair that shows a floating tooltip with value and label at the touched point. No additional libraries needed.

---

## Files Affected

| File | Change |
|---|---|
| `src/server-routes/health.ts` | Fix sync aggregation, summary avg, trend grouping, 1d HR hourly |
| `src/components/health/ExpandableMetricCard.tsx` | Add y-axis, fix x-axis labels per range, add pointerConfig scrubbing, 1d special case |

---

## Error Handling

- If trend fetch fails, `useMetricTrend` already returns `[]` → "No data for this period" shown
- If HR insert conflicts (duplicate `recordedAt`), use upsert with `recordedAt` as key — safe to re-sync
- 1d steps showing single value: graceful fallback if `points.length === 0` → "No data yet today"
