import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { CrowdRow } from "@/components/ui/CrowdRow";
import { getBusTypeGradient } from "@/components/CrowdBadge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SmartSuggestion } from "@/components/ui/SmartSuggestion";
import Colors from "@/constants/colors";
import { MinTouch, Radius, Shadow, Spacing, Type } from "@/constants/theme";
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
  const [listeningField, setListeningField] = useState<"from" | "to" | null>(null);
  const listeningFieldRef = useRef<"from" | "to" | null>(null);
  useEffect(() => {
    listeningFieldRef.current = listeningField;
  }, [listeningField]);

  const micPulse = useSharedValue(1);
  useEffect(() => {
    if (listeningField) {
      micPulse.value = withTiming(1.2, { duration: 600 });
    } else {
      micPulse.value = withTiming(1, { duration: 200 });
    }
  }, [listeningField]);
  const micPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micPulse.value }],
  }));

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    const target = listeningFieldRef.current;
    if (target === "from") setSource(transcript);
    else if (target === "to") setDestination(transcript);
  });
  useSpeechRecognitionEvent("end", () => {
    setListeningField(null);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListeningField(null);
    if (event.error && event.error !== "no-speech" && event.error !== "aborted") {
      Alert.alert("Voice search", "Could not capture voice. Please try again.");
    }
  });

  const startListening = async (field: "from" | "to") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (listeningField) {
      ExpoSpeechRecognitionModule.stop();
      setListeningField(null);
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Microphone permission needed",
          "Please allow microphone and speech recognition to use voice search.",
        );
        return;
      }
      setListeningField(field);
      ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: "free_form",
        },
      });
    } catch (err) {
      setListeningField(null);
      Alert.alert("Voice search unavailable", "Speech recognition is not available on this device.");
    }
  };

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

  const allResults = search.data ?? [];
  // Top 3 ranked: recommended first, then fastest, then least crowded
  const { topResults, otherResults } = useMemo(() => {
    const seen = new Set<string>();
    const picks: Array<{ result: SearchResult; tag: { emoji: string; label: string; color: string } }> = [];
    const recommended = allResults.find((r) => r.isRecommended);
    const fastest = allResults.find((r) => r.isFastest && r.routeId !== recommended?.routeId);
    const leastCrowded = allResults.find(
      (r) => r.isLeastCrowded && r.routeId !== recommended?.routeId && r.routeId !== fastest?.routeId,
    );
    if (recommended) {
      picks.push({ result: recommended, tag: { emoji: "⭐", label: "Recommended", color: Colors.success } });
      seen.add(recommended.routeId);
    }
    if (fastest) {
      picks.push({ result: fastest, tag: { emoji: "🚀", label: "Fastest", color: Colors.primary } });
      seen.add(fastest.routeId);
    }
    if (leastCrowded) {
      picks.push({ result: leastCrowded, tag: { emoji: "🧘", label: "Comfortable", color: Colors.secondary } });
      seen.add(leastCrowded.routeId);
    }
    for (const r of allResults) {
      if (picks.length >= 3) break;
      if (!seen.has(r.routeId)) {
        picks.push({ result: r, tag: { emoji: "🚌", label: "Option", color: Colors.dark.textSecondary } });
        seen.add(r.routeId);
      }
    }
    const others = allResults.filter((r) => !seen.has(r.routeId));
    return { topResults: picks, otherResults: others };
  }, [allResults]);

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
              <Text style={styles.title}>Plan Your Journey</Text>
              <Text style={styles.subtitle}>Find the best bus to your destination</Text>
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
                        placeholder="Where are you?"
                        placeholderTextColor={Colors.dark.textFaint}
                        style={styles.input}
                        returnKeyType="next"
                        accessibilityLabel="Starting stop"
                      />
                    </View>
                    <Pressable
                      onPress={() => startListening("from")}
                      style={[
                        styles.micBtn,
                        listeningField === "from" && styles.micBtnActive,
                      ]}
                      accessibilityLabel="Voice input for starting stop"
                      hitSlop={6}
                    >
                      <Animated.View style={listeningField === "from" ? micPulseStyle : undefined}>
                        <Feather
                          name="mic"
                          size={18}
                          color={listeningField === "from" ? "#fff" : Colors.primary}
                        />
                      </Animated.View>
                    </Pressable>
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
                    <Pressable
                      onPress={() => startListening("to")}
                      style={[
                        styles.micBtn,
                        listeningField === "to" && styles.micBtnActive,
                      ]}
                      accessibilityLabel="Voice input for destination"
                      hitSlop={6}
                    >
                      <Animated.View style={listeningField === "to" ? micPulseStyle : undefined}>
                        <Feather
                          name="mic"
                          size={18}
                          color={listeningField === "to" ? "#fff" : Colors.secondary}
                        />
                      </Animated.View>
                    </Pressable>
                  </View>
                </View>

                {listeningField && (
                  <Animated.View entering={FadeIn} style={styles.listeningBar}>
                    <View style={styles.listeningDot} />
                    <Text style={styles.listeningText}>
                      Listening… speak the {listeningField === "from" ? "starting" : "destination"} stop name
                    </Text>
                  </Animated.View>
                )}

                <Button
                  label="Find My Bus"
                  icon="navigation"
                  onPress={onSearch}
                  disabled={!source.trim() || !destination.trim()}
                  loading={search.isPending}
                  size="lg"
                  style={{ marginTop: 18, minHeight: 56 }}
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
                    message="Tap the microphone next to FROM or TO to speak the stop name."
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

            {/* Top 3 results */}
            {topResults.length > 0 && (
              <View style={{ marginTop: 22 }}>
                <Text style={styles.sectionTitle}>
                  Top picks for you
                </Text>
                {topResults.map((entry, i) => (
                  <Animated.View
                    key={entry.result.routeId + i}
                    entering={FadeInDown.delay(i * 80).springify()}
                  >
                    <ResultCard result={entry.result} tag={entry.tag} highlight={i === 0} />
                  </Animated.View>
                ))}

                {otherResults.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                      More options ({otherResults.length})
                    </Text>
                    {otherResults.map((r, i) => (
                      <Animated.View
                        key={r.routeId + i}
                        entering={FadeInDown.delay(i * 40).springify()}
                      >
                        <ResultCard result={r} />
                      </Animated.View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* No results */}
            {search.data && search.data.length === 0 && (
              <Animated.View entering={FadeIn} style={styles.empty}>
                <Feather name="search" size={36} color={Colors.dark.textMuted} />
                <Text style={styles.emptyText}>No direct routes found</Text>
                <Text style={styles.emptySub}>
                  No single bus connects these stops. Try a nearby major landmark, or pick a popular journey below.
                </Text>
                <View style={[styles.popularGrid, { marginTop: 18, alignSelf: "stretch" }]}>
                  {POPULAR_SEARCHES.map((p) => (
                    <Pressable
                      key={`fb-${p.from}-${p.to}`}
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
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ResultCard({
  result,
  tag,
  highlight,
}: {
  result: SearchResult;
  tag?: { emoji: string; label: string; color: string };
  highlight?: boolean;
}) {
  const gradient = getBusTypeGradient("Vajra");

  return (
    <Card
      onPress={() => router.push(`/route/${result.routeId}` as any)}
      style={{ marginBottom: 12 }}
      glow={highlight ? "rgba(34,197,94,0.4)" : undefined}
    >
      {tag && (
        <View style={[styles.tagStrip, { backgroundColor: tag.color + "22", borderBottomColor: tag.color + "40" }]}>
          <Text style={{ fontSize: 14 }}>{tag.emoji}</Text>
          <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
        </View>
      )}

      <View style={{ padding: 16, gap: 14 }}>
        {/* Top row: route number + ETA */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultBadge}
          >
            <Text style={styles.resultBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {result.routeNumber}
            </Text>
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

        {/* Crowd row */}
        <CrowdRow level={result.crowdLevel} />

        {/* Bottom meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.metaText}>{result.stopCount} stops</Text>
          </View>
          {result.frequency > 0 && (
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={Colors.dark.textMuted} />
              <Text style={styles.metaText}>Every {result.frequency} min</Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark.background },

  title: { ...Type.title, color: Colors.dark.text, marginTop: 2, lineHeight: 32 },
  subtitle: { ...Type.body, color: Colors.dark.textSecondary, marginTop: 6, marginBottom: 20 },

  searchCard: { padding: 18 },
  searchInputs: { gap: 0 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.textMuted,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  input: {
    ...Type.subtitle,
    color: Colors.dark.text,
    paddingVertical: 10,
    minHeight: 44,
  },
  micBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1, borderColor: "rgba(37,99,235,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  listeningBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  listeningDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.danger,
  },
  listeningText: { ...Type.body, color: Colors.danger, flex: 1 },
  divider: {
    height: 28,
    marginLeft: 5,
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
    width: MinTouch,
    height: MinTouch,
    borderRadius: MinTouch / 2,
    backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: { ...Type.heading, color: Colors.dark.text, marginBottom: 12 },

  popularGrid: { gap: 10 },
  popularChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: MinTouch,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  popularText: { ...Type.body, color: Colors.dark.text, flex: 1 },

  tagStrip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tagText: { ...Type.body, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  resultBadge: {
    minWidth: 78, height: 60,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  resultBadgeText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  resultName: { ...Type.subtitle, color: Colors.dark.text },
  resultStops: { ...Type.body, color: Colors.dark.textSecondary, marginTop: 3 },
  resultEta: { fontSize: 30, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: -0.5 },
  resultEtaUnit: { fontSize: 13, color: Colors.dark.textMuted, fontFamily: "Inter_600SemiBold" },

  metaRow: { flexDirection: "row", gap: 18, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...Type.body, color: Colors.dark.textSecondary },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginTop: 18,
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: { ...Type.body, color: Colors.danger, flex: 1 },

  empty: { alignItems: "center", paddingVertical: 50, gap: 8, paddingHorizontal: 8 },
  emptyText: { ...Type.subtitle, color: Colors.dark.text, marginTop: 12, textAlign: "center" },
  emptySub: { ...Type.body, color: Colors.dark.textMuted, textAlign: "center" },
});
