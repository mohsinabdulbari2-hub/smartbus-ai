import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BusType } from "@/lib/api";

type Level = "Low" | "Medium" | "High" | string;

const crowdConfig: Record<string, { bg: string; text: string }> = {
  Low: { bg: "#dcfce7", text: "#15803d" },
  Medium: { bg: "#fef3c7", text: "#b45309" },
  High: { bg: "#fee2e2", text: "#b91c1c" },
};

export function CrowdBadge({ level }: { level: Level }) {
  const c = crowdConfig[level] || crowdConfig.Medium;
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Feather name="users" size={10} color={c.text} />
      <Text style={[s.text, { color: c.text }]}>{level}</Text>
    </View>
  );
}

export function LastBusBadge() {
  return (
    <View style={s.lastBus}>
      <Feather name="alert-triangle" size={10} color="#c2410c" />
      <Text style={s.lastBusText}>Last Bus</Text>
    </View>
  );
}

export function TagBadge({ tag }: { tag: string }) {
  const tagColors: Record<string, { bg: string; text: string }> = {
    Recommended: { bg: "#ffedd5", text: "#c2410c" },
    Fastest: { bg: "#dbeafe", text: "#1d4ed8" },
    "Less Crowded": { bg: "#dcfce7", text: "#15803d" },
    Alternative: { bg: "#e0e7ff", text: "#4338ca" },
  };
  const c = tagColors[tag] || tagColors.Alternative;
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.text, { color: c.text }]}>{tag}</Text>
    </View>
  );
}

// Bus type configuration — Namma BMTC official color scheme (light theme tuned)
export const BUS_TYPE_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  Ordinary:    { bg: "#fee2e2", text: "#dc2626", label: "Ordinary",    icon: "🚌" },
  Vajra:       { bg: "#dbeafe", text: "#2563eb", label: "Vajra AC",    icon: "❄️" },
  Volvo:       { bg: "#dcfce7", text: "#16a34a", label: "Volvo AC",    icon: "⭐" },
  Airport:     { bg: "#fce7f3", text: "#db2777", label: "Airport",     icon: "✈️" },
  MetroFeeder: { bg: "#cffafe", text: "#0891b2", label: "Metro Feeder", icon: "🚇" },
  Night:       { bg: "#ede9fe", text: "#7c3aed", label: "Night",       icon: "🌙" },
};

export function BusTypeBadge({ busType }: { busType: BusType | string }) {
  const c = BUS_TYPE_CONFIG[busType] || BUS_TYPE_CONFIG.Ordinary;
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={s.icon}>{c.icon}</Text>
      <Text style={[s.text, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  icon: { fontSize: 10 },
  lastBus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: "#ffedd5",
  },
  lastBusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#c2410c",
  },
});
