import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import Colors from "@/constants/colors";
import { Radius } from "@/constants/theme";

interface MapStop { lat: number; lng: number; name?: string }
interface RouteMiniMapProps {
  stops: MapStop[];
  busPositionIdx?: number; // index into stops where the bus is
  height?: number;
  color?: string;
}

/**
 * Lightweight SVG route preview — projects lat/lng into a normalized box
 * and draws a smooth polyline through the stops, plus markers for start/end
 * and the bus position. Avoids heavyweight native map deps.
 */
export function RouteMiniMap({ stops, busPositionIdx, height = 140, color = Colors.primary }: RouteMiniMapProps) {
  // Filter out invalid coords (null/undefined/NaN) — defensive against bad data
  const valid = (stops ?? []).filter(
    (s) => s && Number.isFinite(s.lat) && Number.isFinite(s.lng),
  );
  if (valid.length < 2) {
    return <View style={[styles.empty, { height }]} />;
  }

  const lats = valid.map(s => s.lat);
  const lngs = valid.map(s => s.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 320, H = height;
  const PAD = 16;

  // Avoid divide by zero
  const dLat = Math.max(0.0001, maxLat - minLat);
  const dLng = Math.max(0.0001, maxLng - minLng);

  const project = (s: MapStop) => {
    const x = PAD + ((s.lng - minLng) / dLng) * (W - PAD * 2);
    const y = PAD + ((maxLat - s.lat) / dLat) * (H - PAD * 2);
    return { x, y };
  };

  const pts = stops.map(project);

  // Smoothed polyline (cubic curves through every other point)
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const cx = (prev.x + cur.x) / 2;
    const cy = (prev.y + cur.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${cx} ${cy}`;
  }
  d += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const bus = busPositionIdx != null ? pts[Math.max(0, Math.min(pts.length - 1, busPositionIdx))] : null;

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.9" />
            <Stop offset="1" stopColor={Colors.secondary} stopOpacity="0.9" />
          </LinearGradient>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1E293B" />
            <Stop offset="1" stopColor="#0F172A" />
          </LinearGradient>
        </Defs>
        {/* Background */}
        <Path d={`M0 0 L${W} 0 L${W} ${H} L0 ${H} Z`} fill="url(#bgGrad)" />
        {/* Faint grid */}
        {[0.25, 0.5, 0.75].map(p => (
          <Path key={`gx${p}`} d={`M${W * p} 0 L${W * p} ${H}`} stroke="rgba(148,163,184,0.06)" strokeWidth={1} />
        ))}
        {[0.33, 0.66].map(p => (
          <Path key={`gy${p}`} d={`M0 ${H * p} L${W} ${H * p}`} stroke="rgba(148,163,184,0.06)" strokeWidth={1} />
        ))}

        {/* Route polyline glow */}
        <Path d={d} stroke={color} strokeOpacity={0.25} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={d} stroke="url(#routeGrad)" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Intermediate stop dots (downsampled) */}
        {pts.map((p, i) => {
          if (i === 0 || i === pts.length - 1) return null;
          if (pts.length > 12 && i % Math.ceil(pts.length / 10) !== 0) return null;
          return <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={Colors.dark.textMuted} opacity={0.65} />;
        })}

        {/* Start marker */}
        <Circle cx={start.x} cy={start.y} r={8} fill={Colors.primary} fillOpacity={0.25} />
        <Circle cx={start.x} cy={start.y} r={4.5} fill={Colors.primary} />
        <Circle cx={start.x} cy={start.y} r={1.5} fill="#fff" />

        {/* End marker */}
        <Circle cx={end.x} cy={end.y} r={8} fill={Colors.secondary} fillOpacity={0.25} />
        <Circle cx={end.x} cy={end.y} r={4.5} fill={Colors.secondary} />
        <Circle cx={end.x} cy={end.y} r={1.5} fill="#fff" />

        {/* Bus position */}
        {bus && (
          <>
            <Circle cx={bus.x} cy={bus.y} r={11} fill={Colors.success} fillOpacity={0.18} />
            <Circle cx={bus.x} cy={bus.y} r={6} fill={Colors.success} stroke="#fff" strokeWidth={1.5} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },
  empty: {
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
  },
});
