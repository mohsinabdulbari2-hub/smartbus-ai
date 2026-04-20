import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { AnimatedProgress } from "./AnimatedProgress";

type Level = "Low" | "Medium" | "High";

interface CrowdMeterProps {
  level: Level;
  showLabel?: boolean;
  compact?: boolean;
}

const CONFIG: Record<Level, { value: number; color: string; gradient: [string, string]; label: string; emoji: string }> = {
  Low:    { value: 0.22, color: Colors.success, gradient: Colors.gradients.success, label: "Seats available", emoji: "🟢" },
  Medium: { value: 0.55, color: Colors.warning, gradient: Colors.gradients.warning, label: "Moderate crowd",  emoji: "🟡" },
  High:   { value: 0.92, color: Colors.danger,  gradient: Colors.gradients.danger,  label: "Very crowded",    emoji: "🔴" },
};

export function CrowdMeter({ level, showLabel = true, compact }: CrowdMeterProps) {
  const c = CONFIG[level] ?? CONFIG.Low;
  return (
    <View style={[styles.wrap, compact && { gap: 4 }]}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={{ fontSize: compact ? 11 : 12 }}>{c.emoji}</Text>
          <Text style={[styles.label, { color: c.color, fontSize: compact ? 11 : 12 }]}>{c.label}</Text>
        </View>
      )}
      <AnimatedProgress value={c.value} gradient={c.gradient} height={compact ? 4 : 5} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, width: "100%" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { fontFamily: "Inter_700Bold" },
});
