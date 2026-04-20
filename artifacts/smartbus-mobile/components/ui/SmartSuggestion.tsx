import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { Radius } from "@/constants/theme";

interface SmartSuggestionProps {
  title: string;
  message: string;
  onPress?: () => void;
  cta?: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
}

export function SmartSuggestion({ title, message, onPress, cta = "Try alternative", icon = "zap" }: SmartSuggestionProps) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(-8);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });
    ty.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.outer, animStyle]}>
      <Pressable onPress={() => { Haptics.selectionAsync(); onPress?.(); }}>
        <LinearGradient
          colors={["rgba(124,58,237,0.18)", "rgba(37,99,235,0.18)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.inner}
        >
          <View style={styles.iconWrap}>
            <Feather name={icon} size={16} color={Colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
          {onPress && (
            <View style={styles.ctaWrap}>
              <Text style={styles.cta}>{cta}</Text>
              <Feather name="arrow-right" size={14} color={Colors.primary} />
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(124,58,237,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.dark.text },
  message: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.dark.textSecondary, marginTop: 2 },
  ctaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cta: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.primary },
});
