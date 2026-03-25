import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Level = "Low" | "Medium" | "High" | string;

const config: Record<string, { bg: string; text: string; icon: keyof typeof Feather.glyphMap }> = {
  Low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", icon: "users" },
  Medium: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", icon: "users" },
  High: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", icon: "users" },
};

export function CrowdBadge({ level }: { level: Level }) {
  const c = config[level] || config.Medium;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Feather name={c.icon} size={10} color={c.text} />
      <Text style={[styles.text, { color: c.text }]}>{level}</Text>
    </View>
  );
}

export function LastBusBadge() {
  return (
    <View style={styles.lastBus}>
      <Feather name="alert-triangle" size={10} color="#f97316" />
      <Text style={styles.lastBusText}>Last Bus</Text>
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
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{tag}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
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
