import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface AnimatedProgressProps {
  value: number;             // 0..1
  height?: number;
  gradient?: [string, string];
  glow?: boolean;
}

export function AnimatedProgress({
  value,
  height = 6,
  gradient = Colors.gradients.primary,
  glow,
}: AnimatedProgressProps) {
  const v = Math.max(0, Math.min(1, value));
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = withTiming(v, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [v]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${sv.value * 100}%`,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, glow && { shadowColor: gradient[0], shadowOpacity: 0.5, shadowRadius: 8 }]}>
      <Animated.View style={[styles.fill, { height, borderRadius: height / 2 }, fillStyle]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: "rgba(148,163,184,0.15)",
    overflow: "hidden",
    width: "100%",
  },
  fill: { overflow: "hidden" },
});
