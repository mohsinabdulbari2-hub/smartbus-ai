import { Feather, Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TAB_ITEMS = [
  { name: "index", label: "Live", icon: "radio-button-on", lib: "ion" as const },
  { name: "search", label: "Search", icon: "search", lib: "feather" as const },
  { name: "routes", label: "Routes", icon: "map", lib: "feather" as const },
];

function TabIcon({ name, lib, color, size }: { name: string; lib: "feather" | "ion"; color: string; size: number }) {
  if (lib === "ion") return <Ionicons name={name as any} size={size} color={color} />;
  return <Feather name={name as any} size={size} color={color} />;
}

function AnimatedTabButton(props: any) {
  const { accessibilityState, onPress, children } = props;
  const focused = !!accessibilityState?.selected;
  const scale = useSharedValue(focused ? 1.05 : 1);
  const ty = useSharedValue(focused ? -2 : 0);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.08 : 1, { damping: 14, stiffness: 220 });
    ty.value = withSpring(focused ? -3 : 0, { damping: 14, stiffness: 220 });
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: ty.value }],
  }));

  return (
    <AnimatedPressable
      onPress={(e) => { Haptics.selectionAsync(); onPress?.(e); }}
      style={[styles.tabBtn, animStyle]}
    >
      {focused && <View style={styles.activePill} />}
      {children}
    </AnimatedPressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 64;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "Inter_700Bold",
          fontSize: 10,
          marginTop: 2,
          marginBottom: 4,
        },
        tabBarStyle: {
          position: "absolute",
          bottom: insets.bottom + 12,
          left: 16,
          right: 16,
          height: tabBarHeight,
          borderRadius: 24,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          paddingBottom: 0,
        },
        tabBarBackground: () => (
          <View style={styles.tabBg}>
            {Platform.OS === "ios" ? (
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,23,42,0.92)" }]} />
            )}
          </View>
        ),
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
      }}
    >
      {TAB_ITEMS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            tabBarIcon: ({ color, size }) => <TabIcon name={t.icon} lib={t.lib} color={color} size={size - 2} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBg: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingTop: 8,
  },
  activePill: {
    position: "absolute",
    top: 6,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
