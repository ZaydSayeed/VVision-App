# Health Graph Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix health trend charts so every timeframe shows a complete, evenly-spaced series with correct x-axis labels.

**Architecture:** Backend fills missing calendar dates with 0 before returning trend data — complete series every time. Frontend formatXLabel updated to show "May 1" style labels for 30d and 90d ranges.

**Tech Stack:** Express/TypeScript (backend), React Native (frontend), Vitest (tests), react-native-gifted-charts (charts).

---

## File Map

| File | What changes |
|------|-------------|
| `src/server-routes/health.ts` | Add exported `fillDailyGaps` + `fillHourlyGaps` helpers; apply at each query path in the trends endpoint |
| `src/server-routes/health.test.ts` | Add unit tests for both new helpers |
| `src/components/health/ExpandableMetricCard.tsx` | Fix `formatXLabel` for 30d and 90d ranges |

---

### Task 1: Add and test `fillDailyGaps` + `fillHourlyGaps` in the backend

**Files:**
- Modify: `src/server-routes/health.ts`
- Modify: `src/server-routes/health.test.ts`

**Context:** `health.ts` is an Express router. The trends endpoint is at line ~122. The file already exports `syncSchema` and `trendsQuerySchema` — export the new helpers the same way so they can be unit-tested without a DB.

- [ ] **Step 1: Write failing tests for `fillDailyGaps`**

Open `src/server-routes/health.test.ts` and add this describe block after the existing `trendsQuerySchema` block:

```ts
import { fillDailyGaps, fillHourlyGaps } from "./health";

describe("fillDailyGaps", () => {
  it("generates all dates between since and anchor inclusive", () => {
    const result = fillDailyGaps("2026-05-01", "2026-05-03", []);
    expect(result.map((p) => p.date)).toEqual(["2026-05-01", "2026-05-02", "2026-05-03"]);
  });

  it("fills 0 for missing dates", () => {
    const result = fillDailyGaps("2026-05-01", "2026-05-03", [
      { date: "2026-05-02", value: 5000 },
    ]);
    expect(result).toEqual([
      { date: "2026-05-01", value: 0 },
      { date: "2026-05-02", value: 5000 },
      { date: "2026-05-03", value: 0 },
    ]);
  });

  it("returns single point when since equals anchor", () => {
    const result = fillDailyGaps("2026-05-01", "2026-05-01", [{ date: "2026-05-01", value: 3000 }]);
    expect(result).toEqual([{ date: "2026-05-01", value: 3000 }]);
  });
});

describe("fillHourlyGaps", () => {
  it("always returns exactly 24 points", () => {
    expect(fillHourlyGaps([]).length).toBe(24);
  });

  it("fills 0 for missing hours", () => {
    const result = fillHourlyGaps([{ date: "09:00", value: 72 }]);
    expect(result[0]).toEqual({ date: "00:00", value: 0 });
    expect(result[9]).toEqual({ date: "09:00", value: 72 });
    expect(result[23]).toEqual({ date: "23:00", value: 0 });
  });

  it("keys are zero-padded HH:00", () => {
    const result = fillHourlyGaps([]);
    expect(result[0].date).toBe("00:00");
    expect(result[9].date).toBe("09:00");
    expect(result[23].date).toBe("23:00");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/health.test.ts
```

Expected: FAIL — `fillDailyGaps` and `fillHourlyGaps` are not exported yet.

- [ ] **Step 3: Add the helpers to `health.ts` and export them**

In `src/server-routes/health.ts`, add these two functions immediately after the `todayIso` function (around line 78), before the summary route:

```ts
export function fillDailyGaps(
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

export function fillHourlyGaps(
  points: { date: string; value: number }[]
): { date: string; value: number }[] {
  const byHour = new Map(points.map((p) => [p.date, p.value]));
  return Array.from({ length: 24 }, (_, h) => {
    const key = `${String(h).padStart(2, "0")}:00`;
    return { date: key, value: byHour.get(key) ?? 0 };
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/server-routes/health.test.ts
```

Expected: all tests PASS including the new ones.

- [ ] **Step 5: Apply `fillHourlyGaps` to the heart_rate + 1d query path**

In `src/server-routes/health.ts`, find the `heart_rate + 1d` block (around line 145). It currently ends with:

```ts
      const points = Array.from(byHour.entries())
        .sort(([a], [b]) => a - b)
        .map(([h, vals]) => ({
          date: `${String(h).padStart(2, "0")}:00`,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points });
      return;
```

Replace it with:

```ts
      const rawPoints = Array.from(byHour.entries())
        .sort(([a], [b]) => a - b)
        .map(([h, vals]) => ({
          date: `${String(h).padStart(2, "0")}:00`,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points: fillHourlyGaps(rawPoints) });
      return;
```

- [ ] **Step 6: Apply `fillDailyGaps` to the heart_rate + 7d/30d/90d query path**

In `src/server-routes/health.ts`, find the `heart_rate` (non-1d) block. It currently ends with:

```ts
      const points = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points });
      return;
```

Replace it with:

```ts
      const rawPoints = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points: fillDailyGaps(sinceIso, anchorDate, rawPoints) });
      return;
```

- [ ] **Step 7: Apply `fillDailyGaps` to all other metrics query path**

In `src/server-routes/health.ts`, find the final query block (non-heart_rate, all ranges). It currently ends with:

```ts
    res.json({
      metric,
      range,
      points: rows.map((r) => ({ date: r.date as string, value: r.value as number })),
    });
```

Replace it with:

```ts
    const rawPoints = rows.map((r) => ({ date: r.date as string, value: r.value as number }));
    res.json({ metric, range, points: fillDailyGaps(sinceIso, anchorDate, rawPoints) });
```

- [ ] **Step 8: Run full test suite**

```bash
npx vitest run src/server-routes/health.test.ts
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server-routes/health.ts src/server-routes/health.test.ts
git commit -m "feat: fill missing dates in health trend responses"
```

---

### Task 2: Fix x-axis label formatting in ExpandableMetricCard

**Files:**
- Modify: `src/components/health/ExpandableMetricCard.tsx`

**Context:** `formatXLabel` is a pure function at line 26. It takes a date string and range, returns a display string. For 30d the date is "YYYY-MM-DD", for 90d same. Currently 30d returns `date.slice(8)` (day number only) and 90d returns `date.slice(5)` (MM-DD). Both need to return "May 1" style.

- [ ] **Step 1: Update `formatXLabel` for 30d and 90d**

In `src/components/health/ExpandableMetricCard.tsx`, replace the entire `formatXLabel` function (lines 26–42) with:

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

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "ExpandableMetricCard|health"
```

Expected: no errors from either file (pre-existing errors in other files are fine to ignore).

- [ ] **Step 3: Run full test suite one more time**

```bash
npx vitest run src/server-routes/health.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/health/ExpandableMetricCard.tsx
git commit -m "fix: show 'May 1' style x-axis labels for 30d and 90d health charts"
```
