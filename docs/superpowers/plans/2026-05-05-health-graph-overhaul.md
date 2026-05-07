# Health Graph Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix health data accuracy (wrong numbers from sync overwrites) and graph UX (broken 1d view, no axis labels, no scrubbing).

**Architecture:** Three layers of change. (1) The HealthKit service changes how it collects HR — sends individual samples with timestamps instead of pre-averaged daily values. (2) The backend sync/summary/trends routes use metric-appropriate aggregation ($max for cumulative metrics, insertOne for HR). (3) The chart component adds y-axis labels, per-range x-axis labels, pointerConfig scrubbing, and a 1d special case for non-HR metrics.

**Tech Stack:** Express/TypeScript backend, MongoDB bulkWrite/aggregation, `react-native-health` HealthKit SDK, `react-native-gifted-charts` LineChart.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/services/healthkit.ts` | Modify | Send individual HR samples with `recordedAt` instead of daily averages |
| `src/api/health.ts` | Modify | Add `recordedAt?: string` to `Reading` type |
| `src/server-routes/health.ts` | Modify | Fix sync ($max for steps/active/sleep, insertOne for HR), fix summary (average HR), fix trends (hourly 1d HR) |
| `src/components/health/ExpandableMetricCard.tsx` | Modify | Add y-axis, fix x-axis labels per range, add pointerConfig scrubbing, 1d special case |

---

### Task 1: Update Reading type and HealthKit HR collection

**Files:**
- Modify: `src/api/health.ts`
- Modify: `src/services/healthkit.ts`

The `Reading` type needs an optional `recordedAt` field for HR samples. The HealthKit service needs to return individual HR samples (each with `recordedAt: s.startDate`) instead of one daily average.

- [ ] **Step 1: Add `recordedAt` to the Reading type in `src/api/health.ts`**

Find:
```ts
export type Reading = {
  metric: "steps" | "heart_rate" | "active_minutes" | "sleep";
  date: string;
  value: number;
  unit: string;
};
```

Replace with:
```ts
export type Reading = {
  metric: "steps" | "heart_rate" | "active_minutes" | "sleep";
  date: string;
  value: number;
  unit: string;
  recordedAt?: string;
};
```

- [ ] **Step 2: Update `healthkit.ts` to emit individual HR samples**

In `src/services/healthkit.ts`, find the heart rate section (the `// Heart rate — average of samples per day` block):

```ts
  // Heart rate — average of samples per day
  await new Promise<void>((resolve) => {
    AppleHealthKit.getHeartRateSamples({ startDate, endDate, limit: 5000 } as HealthInputOptions, (err, results) => {
      if (!err && results && results.length) {
        const byDay = new Map<string, number[]>();
        for (const s of results) {
          const d = isoDate(new Date(s.startDate));
          if (!byDay.has(d)) byDay.set(d, []);
          byDay.get(d)!.push(s.value);
        }
        for (const [date, vals] of byDay.entries()) {
          const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          out.push({ metric: "heart_rate", date, value: avg, unit: "bpm" });
        }
      }
      resolve();
    });
  });
```

Replace with:
```ts
  // Heart rate — individual samples with recordedAt timestamp
  await new Promise<void>((resolve) => {
    AppleHealthKit.getHeartRateSamples({ startDate, endDate, limit: 5000 } as HealthInputOptions, (err, results) => {
      if (!err && results && results.length) {
        for (const s of results) {
          out.push({
            metric: "heart_rate",
            date: isoDate(new Date(s.startDate)),
            value: Math.round(s.value),
            unit: "bpm",
            recordedAt: s.startDate,
          });
        }
      }
      resolve();
    });
  });
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit` from `/Users/haadisiddiqui/projects/VVision-App`
Expected: no errors in `src/api/health.ts` or `src/services/healthkit.ts`. Pre-existing errors in other files are acceptable.

- [ ] **Step 4: Commit**

```bash
git add src/api/health.ts src/services/healthkit.ts
git commit -m "feat: add recordedAt to Reading type, emit individual HR samples from HealthKit"
```

---

### Task 2: Fix backend sync, summary, and trends endpoints

**Files:**
- Modify: `src/server-routes/health.ts`

Three changes to the backend:
1. **Sync:** `steps`/`active_minutes`/`sleep` use `$max` instead of `$set`. `heart_rate` uses `updateOne` upsert keyed on `(patientId, metric, recordedAt)` — safe to re-sync.
2. **Summary:** HR average from today's individual samples (grouped and averaged), not a single stored value.
3. **Trends:** For 1d HR, return hourly average points (grouped by hour). For 7d/30d/90d, return daily points grouped by date with HR averaged per day.

- [ ] **Step 1: Update the syncSchema to accept `recordedAt`**

In `src/server-routes/health.ts`, find the `readingSchema`:

```ts
const readingSchema = z.object({
  metric: z.enum(METRICS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  value: z.number().min(0),
  unit: z.string().min(1).max(16),
});
```

Replace with:
```ts
const readingSchema = z.object({
  metric: z.enum(METRICS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  value: z.number().min(0),
  unit: z.string().min(1).max(16),
  recordedAt: z.string().optional(),
});
```

- [ ] **Step 2: Fix the sync route to use $max for cumulative metrics and upsert-by-recordedAt for HR**

Find the sync route body (the `ops` construction inside the try block):

```ts
    const ops = parsed.data.readings.map((r) => ({
      updateOne: {
        filter: { patientId, metric: r.metric, date: r.date },
        update: {
          $set: { value: r.value, unit: r.unit, source: "healthkit", syncedAt: now },
          $setOnInsert: { patientId, metric: r.metric, date: r.date },
        },
        upsert: true,
      },
    }));
    const result = await col.bulkWrite(ops, { ordered: false });
    res.json({ written: result.upsertedCount + result.modifiedCount });
```

Replace with:
```ts
    const ops = parsed.data.readings.map((r) => {
      if (r.metric === "heart_rate") {
        const recordedAt = r.recordedAt ?? `${r.date}T00:00:00.000Z`;
        return {
          updateOne: {
            filter: { patientId, metric: "heart_rate", recordedAt },
            update: {
              $set: { value: r.value, unit: r.unit, source: "healthkit", syncedAt: now, date: r.date },
              $setOnInsert: { patientId, metric: "heart_rate", recordedAt },
            },
            upsert: true,
          },
        };
      }
      return {
        updateOne: {
          filter: { patientId, metric: r.metric, date: r.date },
          update: {
            $max: { value: r.value },
            $set: { unit: r.unit, source: "healthkit", syncedAt: now },
            $setOnInsert: { patientId, metric: r.metric, date: r.date },
          },
          upsert: true,
        },
      };
    });
    const result = await col.bulkWrite(ops, { ordered: false });
    res.json({ written: result.upsertedCount + result.modifiedCount });
```

- [ ] **Step 3: Fix the summary route to average today's HR samples**

Find the summary route handler body:

```ts
    const rows = await col.find({ patientId, date: today }).toArray();
    const byMetric: Record<string, { value: number; unit: string }> = {};
    for (const r of rows) byMetric[r.metric] = { value: r.value, unit: r.unit };
    res.json({
      date: today,
      steps: byMetric.steps ?? null,
      heartRate: byMetric.heart_rate ?? null,
      activeMinutes: byMetric.active_minutes ?? null,
      sleep: byMetric.sleep ?? null,
    });
```

Replace with:
```ts
    const [nonHrRows, hrRows] = await Promise.all([
      col.find({ patientId, metric: { $ne: "heart_rate" }, date: today }).toArray(),
      col.find({ patientId, metric: "heart_rate", date: today }).toArray(),
    ]);
    const byMetric: Record<string, { value: number; unit: string }> = {};
    for (const r of nonHrRows) byMetric[r.metric] = { value: r.value, unit: r.unit };
    if (hrRows.length > 0) {
      const avg = Math.round(hrRows.reduce((sum, r) => sum + r.value, 0) / hrRows.length);
      byMetric.heart_rate = { value: avg, unit: "bpm" };
    }
    res.json({
      date: today,
      steps: byMetric.steps ?? null,
      heartRate: byMetric.heart_rate ?? null,
      activeMinutes: byMetric.active_minutes ?? null,
      sleep: byMetric.sleep ?? null,
    });
```

- [ ] **Step 4: Fix the trends route to return hourly HR for 1d, daily otherwise**

Find the trends route handler body:

```ts
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[parsed.data.range];
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);
    const rows = await col
      .find({ patientId, metric: parsed.data.metric, date: { $gte: sinceIso } })
      .sort({ date: 1 })
      .toArray();
    res.json({
      metric: parsed.data.metric,
      range: parsed.data.range,
      points: rows.map((r) => ({ date: r.date, value: r.value })),
    });
```

Replace with:
```ts
    const { metric, range } = parsed.data;
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range];
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);

    if (metric === "heart_rate" && range === "1d") {
      const todayIsoStr = todayIso();
      const rows = await col
        .find({ patientId, metric: "heart_rate", date: todayIsoStr })
        .sort({ recordedAt: 1 })
        .toArray();
      const byHour = new Map<number, number[]>();
      for (const r of rows) {
        const h = r.recordedAt ? new Date(r.recordedAt).getHours() : 0;
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h)!.push(r.value);
      }
      const points = Array.from(byHour.entries())
        .sort(([a], [b]) => a - b)
        .map(([h, vals]) => ({
          date: `${String(h).padStart(2, "0")}:00`,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points });
      return;
    }

    if (metric === "heart_rate") {
      const rows = await col
        .find({ patientId, metric: "heart_rate", date: { $gte: sinceIso } })
        .sort({ date: 1, recordedAt: 1 })
        .toArray();
      const byDate = new Map<string, number[]>();
      for (const r of rows) {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date)!.push(r.value);
      }
      const points = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date,
          value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
      res.json({ metric, range, points });
      return;
    }

    const rows = await col
      .find({ patientId, metric, date: { $gte: sinceIso } })
      .sort({ date: 1 })
      .toArray();
    res.json({
      metric,
      range,
      points: rows.map((r) => ({ date: r.date, value: r.value })),
    });
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit` from `/Users/haadisiddiqui/projects/VVision-App`
Expected: no new errors in `src/server-routes/health.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/health.ts
git commit -m "fix: use \$max for cumulative metrics, average HR in summary, hourly HR in 1d trends"
```

---

### Task 3: Fix ExpandableMetricCard — axis labels, scrubbing, 1d special case

**Files:**
- Modify: `src/components/health/ExpandableMetricCard.tsx`

Four improvements to the chart component:
1. **Y-axis:** Enable y-axis with min/max labels (3 ticks: min, mid, max).
2. **X-axis labels:** Per-range formatting — 7d shows "Mon"/"Tue", 30d shows every 5th date, 90d shows every 2-week label, 1d HR shows hour labels like "6AM"/"12PM"/"6PM".
3. **Scrubbing:** Add `pointerConfig` for draggable crosshair tooltip.
4. **1d special case:** For steps/active_minutes/sleep with `range === "1d"`, don't render the chart — show a large centered number instead.

The `points` returned by `useMetricTrend` for 1d HR will have `date` values like `"08:00"`, `"14:00"` etc. (from the updated trends endpoint).

- [ ] **Step 1: Replace the entire `ExpandableMetricCard.tsx` file**

Read the current file first to confirm imports, then replace it with:

```tsx
import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { RangeToggle, Range } from "./RangeToggle";
import { useMetricTrend } from "../../hooks/useMetricTrend";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

interface Props {
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  value: string | number;
  unit?: string;
  metric: Metric;
  patientId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

const CUMULATIVE_METRICS: Metric[] = ["steps", "active_minutes", "sleep"];

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
  if (range === "30d") return date.slice(8);
  if (range === "90d") return date.slice(5);
  return date.slice(5);
}

function shouldShowLabel(index: number, total: number, range: Range): boolean {
  if (range === "7d") return true;
  if (range === "30d") return index % 5 === 0 || index === total - 1;
  if (range === "90d") return index % 14 === 0 || index === total - 1;
  return true;
}

export function ExpandableMetricCard({
  title, iconName, accentColor, value, unit, metric, patientId, isExpanded, onToggle,
}: Props) {
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>("7d");
  const { points, loading } = useMetricTrend(patientId, metric, range, isExpanded);

  const chartData = useMemo(() => {
    return points.map((p, i) => ({
      value: p.value,
      label: shouldShowLabel(i, points.length, range) ? formatXLabel(p.date, range) : "",
      dataPointText: "",
    }));
  }, [points, range]);

  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 0;
  const minVal = chartData.length > 0 ? Math.min(...chartData.map((d) => d.value)) : 0;

  const is1dCumulative = range === "1d" && CUMULATIVE_METRICS.includes(metric);

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    left: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconCircle: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    title: { ...fonts.medium, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
    valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10, gap: 4 },
    value: { ...fonts.medium, fontSize: 36, color: colors.text },
    unit: { ...fonts.regular, fontSize: 14, color: colors.muted },
    chartWrap: { marginTop: 14 },
    noData: { ...fonts.regular, fontSize: 13, color: colors.muted, marginTop: 14, textAlign: "center", paddingVertical: 20 },
    todayTotal: {
      alignItems: "center",
      paddingVertical: 24,
    },
    todayLabel: { ...fonts.regular, fontSize: 12, color: colors.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 },
    todayValue: { ...fonts.medium, fontSize: 48, color: colors.text },
    todayUnit: { ...fonts.regular, fontSize: 16, color: colors.muted, marginTop: 2 },
    tooltipBox: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    tooltipValue: { ...fonts.medium, fontSize: 14, color: colors.text },
    tooltipLabel: { ...fonts.regular, fontSize: 11, color: colors.muted },
  }), [colors]);

  return (
    <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.left}>
          <View style={[styles.iconCircle, { backgroundColor: accentColor + "22" }]}>
            <Ionicons name={iconName} size={18} color={accentColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value === "—" ? "—" : String(value)}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {isExpanded && (
        <View style={styles.chartWrap}>
          <RangeToggle value={range} onChange={setRange} />
          {loading ? (
            <ActivityIndicator color={accentColor} style={{ marginVertical: 20 }} />
          ) : is1dCumulative ? (
            chartData.length === 0 ? (
              <Text style={styles.noData}>No data yet today</Text>
            ) : (
              <View style={styles.todayTotal}>
                <Text style={styles.todayLabel}>Today's total</Text>
                <Text style={styles.todayValue}>{chartData[0].value.toLocaleString()}</Text>
                {unit ? <Text style={styles.todayUnit}>{unit}</Text> : null}
              </View>
            )
          ) : chartData.length === 0 ? (
            <Text style={styles.noData}>No data for this period</Text>
          ) : (
            <LineChart
              data={chartData}
              areaChart
              startFillColor={accentColor}
              endFillColor={colors.surface}
              startOpacity={0.3}
              endOpacity={0.02}
              color={accentColor}
              thickness={2.5}
              hideDataPoints={chartData.length > 7}
              dataPointsColor={accentColor}
              dataPointsRadius={3}
              hideRules
              yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
              yAxisLabelWidth={36}
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
              initialSpacing={0}
              endSpacing={0}
              spacing={Math.max(24, Math.floor(300 / Math.max(chartData.length, 1)))}
              height={130}
              curved
              maxValue={maxVal > 0 ? maxVal * 1.1 : 10}
              mostNegativeValue={minVal}
              noOfSections={2}
              pointerConfig={{
                pointerStripHeight: 130,
                pointerStripColor: colors.muted + "44",
                pointerStripWidth: 1.5,
                pointerColor: accentColor,
                radius: 5,
                pointerLabelWidth: 90,
                pointerLabelHeight: 44,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: Array<{ value: number; label: string }>) => (
                  <View style={styles.tooltipBox}>
                    <Text style={styles.tooltipValue}>{items[0]?.value?.toLocaleString()}</Text>
                    <Text style={styles.tooltipLabel}>{items[0]?.label}</Text>
                  </View>
                ),
              }}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit` from `/Users/haadisiddiqui/projects/VVision-App`
Expected: no errors in `src/components/health/ExpandableMetricCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/health/ExpandableMetricCard.tsx
git commit -m "feat: add y-axis, x-axis labels, scrubbing, and 1d special case to health graph"
```

---

## Self-Review

**Spec coverage check:**

1. ✅ Wrong numbers — sync now uses `$max` for cumulative (steps/active/sleep), upsert-by-recordedAt for HR
2. ✅ All timeframes same line — `$max` means each daily reading gets the correct max value; multiple syncs no longer collapse to the last value
3. ✅ 1d graph broken — 1d cumulative metrics show a large centered number; 1d HR returns hourly buckets from `recordedAt`
4. ✅ No axis labels — y-axis enabled with `yAxisTextStyle`; x-axis labels formatted per range
5. ✅ No scrubbing — `pointerConfig` added with floating tooltip
6. ✅ HR summary — now averages today's individual samples
7. ✅ HR trends 7d/30d/90d — now groups by date and averages

**No placeholders found.**

**Type consistency:** `recordedAt` added to `Reading` in `src/api/health.ts`. `readingSchema` in `health.ts` allows optional `recordedAt`. Sync route reads `r.recordedAt`. Trend route queries `{ recordedAt: ... }` for HR documents. Consistent.
