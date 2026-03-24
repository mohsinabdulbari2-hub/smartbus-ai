import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number): string {
  if (minutes === 0) return "Due";
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

export function getCrowdColor(level: string | undefined): string {
  if (!level) return "bg-muted text-muted-foreground";
  switch (level.toLowerCase()) {
    case "low":
      return "text-success bg-success/15 border-success/30";
    case "medium":
      return "text-warning-foreground bg-warning/20 border-warning/40";
    case "high":
      return "text-destructive bg-destructive/15 border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
