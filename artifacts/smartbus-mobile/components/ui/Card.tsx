import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { Radius, Shadow } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  glow?: string;             // glow color
  gradient?: [string, string];
  elevated?: boolean;
}

export function Card({ onPress, children, style, glow, gradient, elevated }: CardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const inner = (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {gradient && (
        <LinearGradient
          colors={gradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      {children}
    </View>
  );

  if (!onPress) {
    return <View style={[glow ? Shadow.glow(glow) : Shadow.card]}>{inner}</View>;
  }

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 240 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 240 }); }}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[glow ? Shadow.glow(glow) : Shadow.card, animStyle]}
    >
      {inner}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    overflow: "hidden",
  },
  elevated: {
    backgroundColor: Colors.dark.cardElevated,
    borderColor: Colors.dark.cardBorderStrong,
  },
});
