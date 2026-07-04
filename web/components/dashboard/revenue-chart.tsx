"use client";

/**
 * Minimal daily-revenue bar chart (inline SVG, no chart lib). Buckets revenue
 * events by day and renders normalized bars using the theme's --chart-1 token.
 */
import { useMemo } from "react";
import type { RevenueEvent } from "@runway/shared";

const DAY = 86_400;

export function RevenueChart({
  events,
  height = 96,
}: {
  events: RevenueEvent[];
  height?: number;
}) {
  const bars = useMemo(() => {
    if (events.length === 0) return [];
    const byDay = new Map<number, number>();
    let min = Infinity;
    let max = -Infinity;
    for (const e of events) {
      const day = Math.floor(e.timestamp / DAY);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(e.amount));
      if (day < min) min = day;
      if (day > max) max = day;
    }
    const out: number[] = [];
    for (let d = min; d <= max; d++) out.push(byDay.get(d) ?? 0);
    return out;
  }, [events]);

  if (bars.length === 0) {
    return <div className="text-sm text-muted-foreground">No revenue yet.</div>;
  }

  const peak = Math.max(...bars, 1);
  const gap = 2;
  const barW = 100 / bars.length;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Daily revenue"
    >
      {bars.map((v, i) => {
        const h = (v / peak) * (height - 2);
        return (
          <rect
            key={i}
            x={i * barW + gap / 2}
            y={height - h}
            width={barW - gap}
            height={Math.max(h, 0.5)}
            rx={0.6}
            fill="var(--chart-1)"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}
