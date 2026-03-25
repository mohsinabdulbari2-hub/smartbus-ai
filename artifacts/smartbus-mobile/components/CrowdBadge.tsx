import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BusType } from "@/lib/api";

type Level = "Low" | "Medium" | "High" | string;

const crowdConfig: Record<string, { bg: string; text: string }> = {
  Low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
  Medium: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  High: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
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
      <Feather name="alert-triangle" size={10} color="#f97316" />
      <Text style={s.lastBusText}>Last Bus</Text>
    </View>
  );
}

export function TagBadge({ tag }: { tag: string }) {
  const tagColors: Record<string, { bg: string; text: string }> = {
    Recommended: { bg: "rgba(249,115,22,0.15)", text: "#f97316" },
    Fastest: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
    "Less Crowded": { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
    Alternative: { bg: "rgba(99,102,241,0.15)", text: "#818cf8" },
  };
  const c = tagColors[tag] || tagColors.Alternative;
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.text, { color: c.text }]}>{tag}</Text>
    </View>
  );
}

// Bus type configuration — Namma BMTC official color scheme
export const BUS_TYPE_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  Ordinary: { bg: "rgba(220,38,38,0.15)", text: "#ef4444", label: "Ordinary", icon: "🚌" },
  Vajra:    { bg: "rgba(37,99,235,0.15)", text: "#60a5fa", label: "Vajra AC", icon: "❄️" },
  Volvo:    { bg: "rgba(22,163,74,0.15)", text: "#4ade80", label: "Volvo AC", icon: "⭐" },
  Airport:  { bg: "rgba(219,39,119,0.15)", text: "#f472b6", label: "Airport", icon: "✈️" },
  MetroFeeder: { bg: "rgba(8,145,178,0.15)", text: "#22d3ee", label: "Metro Feeder", icon: "🚇" },
  Night:    { bg: "rgba(124,58,237,0.15)", text: "#a78bfa", label: "Night", icon: "🌙" },
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
    backgroundColor: "rgba(249,115,22,0.15)",
  },
  lastBusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#f97316",
  },
});
