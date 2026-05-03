import React from "react";
import { Badge } from "@/components/ui/Badge";
import Colors from "@/constants/colors";

const CROWD_MAP: Record<string, { variant: any; emoji: string; label: string }> = {
  Low:      { variant: "success", emoji: "🟢", label: "Low" },
  Medium:   { variant: "warning", emoji: "🟡", label: "Medium" },
  High:     { variant: "danger",  emoji: "🔴", label: "High" },
  VeryHigh: { variant: "danger",  emoji: "🟥", label: "Packed" },
};

export function CrowdBadge({
  level,
  size,
}: {
  level: "Low" | "Medium" | "High" | "VeryHigh";
  size?: "sm" | "md";
}) {
  const c = CROWD_MAP[level] || CROWD_MAP.Low;
  return <Badge variant={c.variant} emoji={c.emoji} label={c.label} size={size ?? "sm"} />;
}

export function LastBusBadge({ size }: { size?: "sm" | "md" }) {
  return <Badge variant="warning" icon="moon" label="Last Bus" size={size ?? "sm"} />;
}

export const BUS_TYPE_CONFIG: Record<
  string,
  { color: string; label: string; icon: string; gradient: [string, string] }
> = {
  Ordinary:    { color: "#DC2626", label: "Ordinary",     icon: "🚌", gradient: ["#DC2626", "#991B1B"] },
  Vajra:       { color: "#2563EB", label: "Vajra AC",     icon: "❄️", gradient: ["#2563EB", "#1E40AF"] },
  Volvo:       { color: "#16A34A", label: "Volvo",        icon: "🌟", gradient: ["#16A34A", "#15803D"] },
  Airport:     { color: "#DB2777", label: "Airport",      icon: "✈️", gradient: ["#DB2777", "#9D174D"] },
  MetroFeeder: { color: "#0891B2", label: "Metro Feeder", icon: "🚇", gradient: ["#0891B2", "#155E75"] },
  Night:       { color: "#7C3AED", label: "Night Owl",    icon: "🌙", gradient: ["#7C3AED", "#5B21B6"] },
};

export function BusTypeBadge({ busType, size }: { busType: string; size?: "sm" | "md" }) {
  const c = BUS_TYPE_CONFIG[busType] || BUS_TYPE_CONFIG.Ordinary;
  return <Badge variant="primary" emoji={c.icon} label={c.label} size={size ?? "sm"} />;
}

export function getBusTypeColor(busType: string): string {
  return (BUS_TYPE_CONFIG[busType] || BUS_TYPE_CONFIG.Ordinary).color;
}

export function getBusTypeGradient(busType: string): [string, string] {
  return (BUS_TYPE_CONFIG[busType] || BUS_TYPE_CONFIG.Ordinary).gradient;
}
