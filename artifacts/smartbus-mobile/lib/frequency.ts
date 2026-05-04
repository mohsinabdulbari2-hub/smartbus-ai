export const CROWD_LABEL: Record<string, string> = {
  Low: "Seats available",
  Medium: "Moderate",
  High: "Crowded",
  VeryHigh: "Very crowded",
};

export const CROWD_COLOR: Record<string, string> = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#ef4444",
  VeryHigh: "#b91c1c",
};

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

export function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 11 && hour < 15) return "afternoon";
  if (hour >= 16 && hour < 20) return "evening";
  return "night";
}

/**
 * BMTC-realistic baseline frequency (buses/hr) for a given hour and day type.
 *
 * Weekday patterns:
 *   Late night  (23:00–04:59) →  3/hr  (Night Owl only)
 *   Pre-dawn    (05:00–05:59) →  5/hr  (early depot departures)
 *   Morning pk  (06:00–09:59) → 16/hr  (max fleet)
 *   Midday      (10:00–15:59) → 11/hr  (steady off-peak)
 *   Evening pk  (16:00–20:59) → 17/hr  (highest demand)
 *   Wind-down   (21:00–21:59) →  6/hr  (post-peak taper)
 *   Late eve    (22:00–22:59) →  4/hr
 *
 * Weekend: ~55–60% of weekday volumes.
 */
export function getBaselineFreq(hour: number, isWeekend: boolean): number {
  if (hour >= 23 || hour < 5) return isWeekend ? 2 : 3;
  if (hour < 6)               return isWeekend ? 3 : 5;
  if (hour < 10)              return isWeekend ? 9 : 16;
  if (hour < 16)              return isWeekend ? 7 : 11;
  if (hour < 21)              return isWeekend ? 10 : 17;
  if (hour < 22)              return isWeekend ? 4 : 6;
  return                             isWeekend ? 2 : 4;
}

export function getLiveFrequency(etaSeconds: number[]): number | null {
  if (!etaSeconds || etaSeconds.length < 2) return null;
  const sorted = [...etaSeconds].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > 0) gaps.push(gap);
  }
  if (!gaps.length) return null;
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.round(3600 / avg);
}

export function fuseFrequency(
  base: number,
  liveEtaSeconds: number[],
): { freq: number; isLive: boolean } {
  const now = new Date();
  const hour = now.getHours();
  const isWeekend = [0, 6].includes(now.getDay());

  // Time-aware ceiling replaces the old flat 30/8 caps.
  const ceiling = getBaselineFreq(hour, isWeekend);
  const effectiveBase = Math.min(base, ceiling);

  const live = getLiveFrequency(liveEtaSeconds);
  let freq: number;
  let isLive: boolean;
  if (!live || live <= 0 || live > 120) {
    freq = effectiveBase; isLive = false;
  } else {
    const weight = liveEtaSeconds.length >= 4 ? 0.5 : liveEtaSeconds.length >= 2 ? 0.35 : 0.2;
    freq = Math.round(effectiveBase * (1 - weight) + live * weight);
    isLive = true;
  }
  freq = Math.min(freq, ceiling);
  return { freq, isLive };
}
