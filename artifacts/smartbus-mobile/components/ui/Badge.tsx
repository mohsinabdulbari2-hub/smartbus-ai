import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Colors from "@/constants/colors";
import { Radius } from "@/constants/theme";

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "neutral" | "secondary";

interface BadgeProps {
  variant?: BadgeVariant;
  icon?: React.ComponentProps<typeof Feather>["name"];
  emoji?: string;
  label: string;
  style?: ViewStyle;
  size?: "sm" | "md";
}

const VARIANT_MAP: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  primary:   { bg: "rgba(37,99,235,0.15)",  fg: "#60A5FA", border: "rgba(37,99,235,0.35)" },
  secondary: { bg: "rgba(124,58,237,0.15)", fg: "#A78BFA", border: "rgba(124,58,237,0.35)" },
  success:   { bg: Colors.successSoft,      fg: Colors.success, border: "rgba(34,197,94,0.35)" },
  warning:   { bg: Colors.warningSoft,      fg: Colors.warning, border: "rgba(245,158,11,0.35)" },
  danger:    { bg: Colors.dangerSoft,       fg: Colors.danger,  border: "rgba(239,68,68,0.35)" },
  neutral:   { bg: "rgba(148,163,184,0.12)", fg: Colors.dark.textSecondary, border: "rgba(148,163,184,0.25)" },
};

export function Badge({ variant = "neutral", icon, emoji, label, style, size = "md" }: BadgeProps) {
  const v = VARIANT_MAP[variant];
  const sizeStyles = size === "sm"
    ? { paddingHorizontal: 8, paddingVertical: 3, gap: 4 }
    : { paddingHorizontal: 10, paddingVertical: 5, gap: 5 };
  const fontSize = size === "sm" ? 10 : 11;

  return (
    <View style={[styles.badge, sizeStyles, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      {emoji ? <Text style={{ fontSize }}>{emoji}</Text> : null}
      {icon ? <Feather name={icon} size={fontSize + 1} color={v.fg} /> : null}
      <Text style={[styles.label, { color: v.fg, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: { fontFamily: "Inter_700Bold" },
});
