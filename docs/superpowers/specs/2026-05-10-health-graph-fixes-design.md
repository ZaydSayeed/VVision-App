# Health Graph Fixes Design

## Problem

Two bugs affect the health trend charts in `ExpandableMetricCard`:

1. **Same graph across all timeframes** — the backend only returns days with actual data. A patient with 5 days of readings gets the same 5 points whether they select 7d, 30d, or 90d. The chart looks identical because the data is identical.

2. **Wrong x-axis labels** — `shouldShowLabel` uses array index (`index % 5`) to decide which labels to show. When data is sparse, array index doesn't correspond to calendar position. Also, 30d labels show just the day number ("15") and 90d shows "MM-DD" ("05-15") — both confusing without month context.

## Root Cause

The backend trends endpoint (`GET /:patientId/health/trends`) queries for rows `date >= sinceIso` and returns only what exists in MongoDB. It never fills in missing calendar dates with zero values. The frontend then receives a sparse, incomplete array and tries to render it as if it were evenly spaced.

## Solution

Fix on the backend: generate the complete date/hour series for each range, merge actual data in, and fill 0 for missing slots. The frontend receives a full, evenly-spaced array every time and renders correctly without any logic changes to hooks or the API client.

Fix on the frontend: improve 30d and 90d label formatting to show human-readable month + day.

---

## Backend Changes (`src/server-routes/health.ts`)

### Helper: `fillDailyGaps`

```ts
function fillDailyGaps(
  sinceIso: string,
  anchorDate: string,
  points: { date: string; value: number }[]
): { date: string; value: number }[] {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const result: { date: string; value: number }[] = [];
  const cursor = new Date(sinceIso + "T12:00:00Z");
  const end = new Date(anchorDate + "T12:00:00Z");
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    result.push({ date: iso, value: byDate.get(iso) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
```

Applied to: all non-heart_rate metric queries for 7d, 30d, 90d ranges, and heart_rate queries for 7d, 30d, 90d ranges.

### Helper: `fillHourlyGaps`

```ts
function fillHourlyGaps(
  points: { date: string; value: number }[]
): { date: string; value: number }[] {
  const byHour = new Map(points.map((p) => [p.date, p.value]));
  return Array.from({ length: 24 }, (_, h) => {
    const key = `${String(h).padStart(2, "0")}:00`;
    return { date: key, value: byHour.get(key) ?? 0 };
  });
}
```

Applied to: heart_rate 1d range only. Returns all 24 hour slots; empty hours get 0.

### Application Points

- **heart_rate + 1d**: after building `points` from `byHour`, wrap with `fillHourlyGaps(points)`
- **heart_rate + 7d/30d/90d**: after building `points` from `byDate`, wrap with `fillDailyGaps(sinceIso, anchorDate, points)`
- **all other metrics + any range**: after building `points` from rows, wrap with `fillDailyGaps(sinceIso, anchorDate, points)`

No schema changes. Response shape is identical — `{ metric, range, points: [{date, value}] }`.

---

## Frontend Changes (`src/components/health/ExpandableMetricCard.tsx`)

### Fix `formatXLabel` for 30d and 90d

```ts
function formatXLabel(date: string, range: Range): string {
  if (range === "1d") {
    const hour = parseInt(date.slice(0, 2), 10);
    if (hour === 0) return "12AM";
    if (hour === 6) return "6AM";
    if (hour === 12) return "12PM";
    if (hour === 18) return "6PM";
    return "";
  }
  if (range === "7d") {
    const d = new Date(date + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }
  if (range === "30d") {
    const d = new Date(date + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  if (range === "90d") {
    const d = new Date(date + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return date.slice(5);
}
```

30d shows "May 1", "May 6", etc. 90d shows "Apr 15", "May 1", etc.

### `shouldShowLabel` — no change needed

With filled gaps, every array index corresponds to exactly one calendar slot. The existing logic (`index % 5` for 30d, `index % 14` for 90d) now produces correct, evenly-spaced labels.

### 1d cumulative check — no change needed

`is1dCumulative` already skips the chart for steps/active_minutes/sleep on 1d, showing "Today's total" instead. Heart rate 1d now always renders the full 24-hour area chart.

---

## Files Touched

| File | Change |
|------|--------|
| `src/server-routes/health.ts` | Add `fillDailyGaps` + `fillHourlyGaps` helpers, apply at each query path |
| `src/components/health/ExpandableMetricCard.tsx` | Fix `formatXLabel` for 30d and 90d |

No changes to: hooks, API client, RangeToggle, HealthScreen, backend schema, tests (existing tests remain valid).

---

## Success Criteria

- Switching timeframes always shows a different-looking chart (full date range filled)
- 7d x-axis shows Mon–Sun labels
- 30d x-axis shows "May 1", "May 6" style labels every 5 days
- 90d x-axis shows "Apr 15", "May 1" style labels every 2 weeks
- 1d heart rate shows all 24 hours; empty hours render as 0
- 1d steps/sleep/active_minutes still shows "Today's total" (no chart)
