import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, radius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1, true,
    );
    return () => cancelAnimation(opacity);
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius: radius },
        animStyle,
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
        <Skeleton width={56} height={56} radius={14} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="80%" height={14} />
          <Skeleton width="55%" height={11} />
        </View>
      </View>
      <Skeleton width="100%" height={6} radius={3} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Skeleton width={80} height={22} radius={11} />
        <Skeleton width={60} height={22} radius={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: "rgba(148,163,184,0.15)" },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    padding: 16,
  },
});
