import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CrowdMeter } from "@/components/ui/CrowdMeter";
import { CrowdBadge, BUS_TYPE_CONFIG, getBusTypeGradient } from "@/components/CrowdBadge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SmartSuggestion } from "@/components/ui/SmartSuggestion";
import Colors from "@/constants/colors";
import { Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { api, type SearchResult } from "@/lib/api";

const POPULAR_SEARCHES = [
  { from: "Majestic", to: "Electronic City" },
  { from: "Whitefield", to: "Marathahalli" },
  { from: "Banashankari", to: "Hebbal" },
  { from: "Indiranagar", to: "Koramangala" },
];

export default function SearchScreen() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  const swapRotate = useSharedValue(0);
  const swapStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swapRotate.value}deg` }],
  }));

  const search = useMutation({
    mutationFn: ({ s, d }: { s: string; d: string }) => api.searchRoutes(s, d),
  });

  const onSearch = () => {
    if (!source.trim() || !destination.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    search.mutate({ s: source.trim(), d: destination.trim() });
  };

  const onSwap = () => {
    Haptics.selectionAsync();
    swapRotate.value = withSpring(swapRotate.value + 180, { damping: 14, stiffness: 200 });
    setSource(destination);
    setDestination(source);
  };

  const onPopular = (from: string, to: string) => {
    Haptics.selectionAsync();
    setSource(from);
    setDestination(to);
    search.mutate({ s: from, d: to });
  };

  const results = search.data ?? [];
  const recommended = results.find((r) => r.isRecommended);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <Animated.View entering={FadeInUp.duration(450)} style={{ marginTop: 8 }}>
              <Text style={styles.eyebrow}>FIND BEST ROUTE</Text>
              <Text style={styles.title}>Plan your journey</Text>
              <Text style={styles.subtitle}>AI-powered routing across BMTC's network</Text>
            </Animated.View>

            {/* Search card */}
            <Animated.View entering={FadeInUp.delay(80).duration(450)}>
              <Card style={styles.searchCard} glow={Colors.primaryGlow}>
                <View style={styles.searchInputs}>
                  <View style={styles.inputRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>FROM</Text>
                      <TextInput
                        value={source}
                        onChangeText={setSource}
                        placeholder="Source stop or area"
                        placeholderTextColor={Colors.dark.textFaint}
                        style={styles.input}
                        returnKeyType="next"
                      />
                    </View>
                  </View>

                  <View style={styles.divider}>
                    <View style={styles.dottedLine} />
                    <Pressable onPress={onSwap} style={styles.swapBtn}>
                      <Animated.View style={swapStyle}>
                        <Feather name="repeat" size={16} color={Colors.primary} />
                      </Animated.View>
                    </Pressable>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>TO</Text>
                      <TextInput
                        value={destination}
                        onChangeText={setDestination}
                        placeholder="Destination stop or area"
                        placeholderTextColor={Colors.dark.textFaint}
                        style={styles.input}
                        returnKeyType="search"
                        onSubmitEditing={onSearch}
                      />
                    </View>
                  </View>
                </View>

                <Button
                  label="Find best route"
                  icon="navigation"
                  onPress={onSearch}
                  disabled={!source.trim() || !destination.trim()}
                  loading={search.isPending}
                  size="lg"
                  style={{ marginTop: 14 }}
                />
              </Card>
            </Animated.View>

            {/* Popular searches */}
            {!search.data && !search.isPending && (
              <Animated.View entering={FadeInUp.delay(160)} style={{ marginTop: 22 }}>
                <Text style={styles.sectionTitle}>Popular journeys</Text>
                <View style={styles.popularGrid}>
                  {POPULAR_SEARCHES.map((p, i) => (
                    <Pressable
                      key={`${p.from}-${p.to}`}
                      onPress={() => onPopular(p.from, p.to)}
                      style={styles.popularChip}
                    >
                      <Feather name="trending-up" size={12} color={Colors.dark.textMuted} />
                      <Text style={styles.popularText} numberOfLines={1}>
                        {p.from} → {p.to}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ marginTop: 16 }}>
                  <SmartSuggestion
                    title="Try voice search"
                    message="Long-press FROM field to dictate stop names hands-free."
                    icon="mic"
                    cta="Got it"
                  />
                </View>
              </Animated.View>
            )}

            {/* Loading state */}
            {search.isPending && (
              <View style={{ gap: 14, marginTop: 22 }}>
                <CardSkeleton />
                <CardSkeleton />
              </View>
            )}

            {/* Error */}
            {search.isError && (
              <Animated.View entering={FadeIn} style={styles.errorCard}>
                <Feather name="alert-circle" size={20} color={Colors.danger} />
                <Text style={styles.errorText}>
                  Search failed. Try checking your spelling or use a different stop.
                </Text>
              </Animated.View>
            )}

            {/* Results */}
            {results.length > 0 && (
              <View style={{ marginTop: 22 }}>
                {recommended && (
                  <Animated.View entering={FadeInDown.duration(450)}>
                    <SummaryCard result={recommended} totalOptions={results.length} />
                  </Animated.View>
                )}

                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                  All options ({results.length})
                </Text>
                {results.map((r, i) => (
                  <Animated.View
                    key={r.routeId + i}
                    entering={FadeInDown.delay(i * 50).springify()}
                  >
                    <ResultCard result={r} />
                  </Animated.View>
                ))}
              </View>
            )}

            {/* No results */}
            {search.data && search.data.length === 0 && (
              <View style={styles.empty}>
                <Feather name="search" size={36} color={Colors.dark.textMuted} />
                <Text style={styles.emptyText}>No direct routes found</Text>
                <Text style={styles.emptySub}>Try nearby stops or major landmarks</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function SummaryCard({ result, totalOptions }: { result: SearchResult; totalOptions: number }) {
  return (
    <Card glow="rgba(34,197,94,0.4)">
      <LinearGradient
        colors={["rgba(34,197,94,0.18)", "rgba(37,99,235,0.12)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.recommendDot}>
            <Feather name="award" size={14} color="#fff" />
          </View>
          <Text style={styles.recommendLabel}>RECOMMENDED · {totalOptions} options found</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 12, gap: 10 }}>
          <Text style={styles.summaryEta}>{result.etaMinutes}</Text>
          <Text style={styles.summaryUnit}>min</Text>
          <View style={{ flex: 1 }} />
          <Badge variant="success" emoji="✓" label="Best match" size="md" />
        </View>

        <Text style={styles.summaryRoute} numberOfLines={1}>
          {result.routeNumber} · {result.routeName}
        </Text>
        <Text style={styles.summaryStops}>
          {result.sourceStop} → {result.destinationStop} · {result.stopCount} stops · every {result.frequency} min
        </Text>

        <View style={{ flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {result.isFastest && <Badge variant="primary" icon="zap" label="Fastest" size="sm" />}
          {result.isLeastCrowded && <Badge variant="success" icon="users" label="Least crowded" size="sm" />}
          <CrowdBadge level={result.crowdLevel} />
        </View>
      </View>
    </Card>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const gradient = getBusTypeGradient("Vajra");

  return (
    <Card
      onPress={() => router.push(`/route/${result.routeId}` as any)}
      style={{ marginBottom: 10 }}
    >
      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultBadge}
          >
            <Text style={styles.resultBadgeText} numberOfLines={1}>{result.routeNumber}</Text>
          </LinearGradient>

          <View style={{ flex: 1 }}>
            <Text style={styles.resultName} numberOfLines={1}>{result.routeName}</Text>
            <Text style={styles.resultStops} numberOfLines={1}>
              {result.sourceStop} → {result.destinationStop}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.resultEta}>{result.etaMinutes}</Text>
            <Text style={styles.resultEtaUnit}>min</Text>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <CrowdMeter level={result.crowdLevel} compact />
        </View>

        <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap" }}>
          {result.tags?.slice(0, 3).map((t) => (
            <Badge key={t} variant="neutral" label={t} size="sm" />
          ))}
          {result.frequency > 0 && (
            <Badge variant="primary" icon="clock" label={`${result.frequency} min`} size="sm" />
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark.background },

  eyebrow: { ...Type.micro, color: Colors.secondary, letterSpacing: 1.5 },
  title: { ...Type.display, color: Colors.dark.text, marginTop: 2 },
  subtitle: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 4, marginBottom: 18 },

  searchCard: { padding: 16 },
  searchInputs: { gap: 0 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  inputLabel: {
    ...Type.micro,
    color: Colors.dark.textMuted,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  input: {
    ...Type.subtitle,
    color: Colors.dark.text,
    paddingVertical: 6,
  },
  divider: {
    height: 24,
    marginLeft: 4,
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  dottedLine: {
    width: 2,
    height: "100%",
    borderLeftWidth: 2,
    borderLeftColor: Colors.dark.cardBorderStrong,
    borderStyle: "dashed",
    marginLeft: 3,
  },
  swapBtn: {
    marginLeft: "auto",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: { ...Type.heading, color: Colors.dark.text, marginBottom: 10 },

  popularGrid: { gap: 8 },
  popularChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  popularText: { ...Type.body, color: Colors.dark.textSecondary, flex: 1 },

  recommendDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.success,
    alignItems: "center", justifyContent: "center",
  },
  recommendLabel: { ...Type.micro, color: Colors.success, letterSpacing: 1.2 },
  summaryEta: { ...Type.display, fontSize: 44, color: Colors.dark.text },
  summaryUnit: { ...Type.subtitle, color: Colors.dark.textMuted },
  summaryRoute: { ...Type.subtitle, color: Colors.dark.text, marginTop: 8 },
  summaryStops: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 2 },

  resultBadge: {
    minWidth: 56, height: 44,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  resultBadgeText: { ...Type.heading, color: "#fff" },
  resultName: { ...Type.subtitle, color: Colors.dark.text },
  resultStops: { ...Type.caption, color: Colors.dark.textMuted, marginTop: 2 },
  resultEta: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary },
  resultEtaUnit: { fontSize: 10, color: Colors.dark.textMuted, fontFamily: "Inter_500Medium" },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginTop: 18,
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: { ...Type.caption, color: Colors.danger, flex: 1 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText: { ...Type.subtitle, color: Colors.dark.text, marginTop: 12 },
  emptySub: { ...Type.caption, color: Colors.dark.textMuted },
});
