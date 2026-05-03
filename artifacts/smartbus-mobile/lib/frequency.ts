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
  const live = getLiveFrequency(liveEtaSeconds);
  if (!live || live <= 0 || live > 120) return { freq: base, isLive: false };
  const weight =
    liveEtaSeconds.length >= 4 ? 0.5 :
    liveEtaSeconds.length >= 2 ? 0.35 : 0.2;
  return {
    freq: Math.round(base * (1 - weight) + live * weight),
    isLive: true,
  };
}
