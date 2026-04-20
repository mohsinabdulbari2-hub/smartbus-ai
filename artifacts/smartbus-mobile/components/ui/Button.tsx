import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { Radius, Shadow } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  iconRight?: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  style?: ViewStyle;
  hapticIntensity?: "light" | "medium";
}

export function Button({
  label,
  onPress,
  icon,
  iconRight,
  disabled,
  loading,
  variant = "primary",
  size = "md",
  style,
  hapticIntensity = "medium",
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isGradient = isPrimary || isDanger;
  const colors = isDanger ? Colors.gradients.danger : Colors.gradients.primary;

  const padding = size === "lg" ? { paddingVertical: 17 } : { paddingVertical: 13 };
  const fontSize = size === "lg" ? 16 : 14;

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(
      hapticIntensity === "light" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
    onPress();
  };

  const Wrapper: any = isGradient ? LinearGradient : Animated.View;
  const wrapperProps = isGradient
    ? { colors, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }
    : {};

  return (
    <AnimatedPressable
      onPressIn={() => { if (!disabled) scale.value = withSpring(0.96, { damping: 18, stiffness: 240 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 240 }); }}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.outer,
        isPrimary && Shadow.glow(Colors.primaryGlow),
        isDanger && Shadow.glow("rgba(239,68,68,0.4)"),
        animStyle,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Wrapper {...wrapperProps} style={[
        styles.inner,
        padding,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
      ]}>
        {icon && !loading && <Feather name={icon} size={fontSize + 4} color="#fff" />}
        {loading && <Feather name="loader" size={fontSize + 4} color="#fff" />}
        <Text style={[styles.label, { fontSize, color: variant === "ghost" ? Colors.dark.text : "#fff" }]}>
          {loading ? "Loading..." : label}
        </Text>
        {iconRight && !loading && <Feather name={iconRight} size={fontSize + 2} color="#fff" />}
      </Wrapper>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: Radius.lg, overflow: "hidden" },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  secondary: { backgroundColor: "rgba(124,58,237,0.85)" },
  ghost: { backgroundColor: "rgba(148,163,184,0.1)", borderWidth: 1, borderColor: "rgba(148,163,184,0.2)" },
  label: { fontFamily: "Inter_700Bold" },
});
