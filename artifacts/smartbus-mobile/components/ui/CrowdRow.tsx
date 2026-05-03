import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { Radius, Type } from "@/constants/theme";

type Level = "Low" | "Medium" | "High" | "VeryHigh";

const CONFIG: Record<
  Level,
  { color: string; bg: string; border: string; label: string; icon: keyof typeof Feather.glyphMap; dot: string }
> = {
  Low: {
    color: Colors.success,
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    label: "Seats available",
    icon: "check-circle",
    dot: "🟢",
  },
  Medium: {
    color: Colors.warning,
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    label: "Moderate crowd",
    icon: "users",
    dot: "🟡",
  },
  High: {
    color: Colors.danger,
    bg: "rgba(239,68,68,0.14)",
    border: "rgba(239,68,68,0.4)",
    label: "Crowded",
    icon: "alert-triangle",
    dot: "🔴",
  },
  VeryHigh: {
    color: "#B91C1C",
    bg: "rgba(185,28,28,0.18)",
    border: "rgba(185,28,28,0.5)",
    label: "Packed — try the next bus",
    icon: "alert-octagon",
    dot: "🟥",
  },
};

/**
 * Full-width crowd indicator row with icon + label + color.
 * Designed for accessibility — never relies on color alone.
 */
export function CrowdRow({ level }: { level: Level }) {
  const c = CONFIG[level] ?? CONFIG.Low;
  return (
    <View
      style={[styles.row, { backgroundColor: c.bg, borderColor: c.border }]}
      accessibilityRole="text"
      accessibilityLabel={`Crowd level: ${c.label}`}
    >
      <Text style={styles.dot}>{c.dot}</Text>
      <Feather name={c.icon} size={16} color={c.color} />
      <Text style={[styles.label, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  dot: { fontSize: 14 },
  label: { ...Type.body, fontFamily: "Inter_700Bold" },
});
