import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Bus, X, MapPin, Users, Clock, Navigation, Radio } from "lucide-react";
import { Link } from "wouter";
import { LiveBus, BusStop, BusRouteDetail } from "@workspace/api-client-react";
import { useGetRouteFrequency } from "@workspace/api-client-react";
import { haversineKm } from "@/hooks/use-geolocation";
import { CROWD_LABEL, CROWD_COLOR, getTimeSlot, fuseFrequency } from "@/lib/frequency";

export type LiveMapMode = "nearby" | "all";

interface LiveMapProps {
  buses?: LiveBus[];
  stops?: BusStop[];
  mode?: LiveMapMode;
  userLat?: number;
  userLng?: number;
  fleetTotal?: number | null;
  nearbyRadiusKm?: number;
}

const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];
const MAX_VISIBLE_BUSES = 100;

// ---------------- Marker factories ----------------

const dotIconCache = new Map<string, L.DivIcon>();
function getDotIcon(color: string, selected: boolean): L.DivIcon {
  const key = `${color}|${selected ? 1 : 0}`;
  const cached = dotIconCache.get(key);
  if (cached) return cached;
  const size = selected ? 22 : 14;
  const ring = selected ? 3 : 2;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${ring}px solid #fff;box-shadow:0 0 ${selected ? 14 : 6}px ${color}aa,0 2px 6px rgba(0,0,0,0.5);"></div>`;
  const icon = L.divIcon({
    html,
    className: "bg-transparent border-0",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  dotIconCache.set(key, icon);
  return icon;
}

const arrowIconCache = new Map<string, L.DivIcon>();
function getArrowIcon(color: string, heading: number, selected: boolean): L.DivIcon {
  const bucket = Math.round(heading / 15) * 15;
  const key = `${color}|${bucket}|${selected ? 1 : 0}`;
  const cached = arrowIconCache.get(key);
  if (cached) return cached;
  const size = selected ? 26 : 16;
  const html = `
    <div style="transform:rotate(${bucket}deg);transform-origin:center;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="filter:drop-shadow(0 0 ${selected ? 8 : 3}px ${color}cc) drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
        <path d="M12 2 L19 20 L12 16 L5 20 Z" fill="${color}" stroke="#fff" stroke-width="${selected ? 1.5 : 1}" stroke-linejoin="round"/>
      </svg>
    </div>`;
  const icon = L.divIcon({
    html,
    className: "bg-transparent border-0",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  arrowIconCache.set(key, icon);
  return icon;
}

// ---------------- Route detail cache ----------------

interface CachedRoute {
  shape: [number, number][] | null;
  stops: BusStop[];
}

const routeDetailCache = new Map<string, CachedRoute>();
const inflight = new Map<string, Promise<void>>();
const failureBackoff = new Map<string, number>();
const FAILURE_BACKOFF_MS = 30_000;

function fetchRouteDetail(routeId: string): Promise<void> {
  if (routeDetailCache.has(routeId)) return Promise.resolve();
  const nextAllowed = failureBackoff.get(routeId) ?? 0;
  if (Date.now() < nextAllowed) return Promise.resolve();
  const existing = inflight.get(routeId);
  if (existing) return existing;
  const p = fetch(`/api/routes/${routeId}`)
    .then((res) => (res.ok ? (res.json() as Promise<BusRouteDetail>) : Promise.reject(res.status)))
    .then((r: BusRouteDetail) => {
      routeDetailCache.set(routeId, {
        shape: (r.shape as [number, number][] | null | undefined) ?? null,
        stops: r.stops ?? [],
      });
      failureBackoff.delete(routeId);
    })
    .catch(() => {
      failureBackoff.set(routeId, Date.now() + FAILURE_BACKOFF_MS);
    })
    .finally(() => {
      inflight.delete(routeId);
    });
  inflight.set(routeId, p);
  return p;
}

// ---------------- Viewport tracker ----------------

function ViewportTracker({ onBounds }: { onBounds: (b: L.LatLngBounds) => void }) {
  const map = useMap();
  useEffect(() => {
    onBounds(map.getBounds());
  }, [map, onBounds]);
  useMapEvents({
    moveend: () => onBounds(map.getBounds()),
    zoomend: () => onBounds(map.getBounds()),
  });
  return null;
}

// ---------------- Click-to-deselect ----------------

function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: () => onClick() });
  return null;
}

// ---------------- Auto-focus: fly to bus once on selection ----------------
// Fires a one-time flyTo whenever the selected bus ID changes.
// Does NOT activate follow mode — that requires the explicit Follow button.

const AUTO_FOCUS_ZOOM = 15;

function AutoFocusBus({ bus }: { bus: LiveBus | null }) {
  const map = useMap();
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bus) { prevIdRef.current = null; return; }
    if (bus.id === prevIdRef.current) return;
    prevIdRef.current = bus.id;
    map.flyTo([bus.lat, bus.lng], AUTO_FOCUS_ZOOM, { duration: 0.6 });
  }, [bus, map]);

  return null;
}

// ---------------- Follow mode: smooth camera tracking ----------------
// Pans to keep the tracked bus centered on every position update.
// First update flies to zoom 15; subsequent ones just pan so the user
// can pinch-zoom freely. Exits automatically when the user drags.

const FOLLOW_MIN_DELTA_DEG = 0.0001;
const FOLLOW_ZOOM = 15;

function BusFollower({
  trackedBus,
  onUserDrag,
}: {
  trackedBus: LiveBus | null;
  onUserDrag: () => void;
}) {
  const map = useMap();
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const hasZoomed = useRef(false);

  useEffect(() => {
    lastPos.current = null;
    hasZoomed.current = false;
  }, [trackedBus?.id]);

  useEffect(() => {
    if (!trackedBus) return;
    const next = { lat: trackedBus.lat, lng: trackedBus.lng };
    const prev = lastPos.current;
    if (prev) {
      const dx = Math.abs(prev.lat - next.lat);
      const dy = Math.abs(prev.lng - next.lng);
      if (dx < FOLLOW_MIN_DELTA_DEG && dy < FOLLOW_MIN_DELTA_DEG) return;
    }
    lastPos.current = next;
    if (!hasZoomed.current) {
      map.flyTo([next.lat, next.lng], FOLLOW_ZOOM, { duration: 0.8 });
      hasZoomed.current = true;
    } else {
      map.panTo([next.lat, next.lng], { animate: true, duration: 0.6 });
    }
  }, [trackedBus?.lat, trackedBus?.lng, trackedBus, map]);

  useMapEvents({
    dragstart: () => { if (trackedBus) onUserDrag(); },
    zoomstart: () => { if (trackedBus) onUserDrag(); },
  });

  return null;
}

// ---------------- Helpers ----------------

function distanceSq(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
}

function etaFromDistance(meters: number, speedKmh: number): number | null {
  if (speedKmh < 5) return null;
  const mps = speedKmh * (1000 / 3600);
  return Math.max(1, Math.ceil(meters / mps / 60));
}

// ---------------- Frequency-aware bus detail panel ----------------
// Extracted as its own component so it can safely call hooks (useGetRouteFrequency).

interface BusPanelProps {
  bus: LiveBus;
  buses: LiveBus[];
  etaMin: number | null;
  isFollowing: boolean;
  onFollow: () => void;
  onClose: () => void;
}

function BusPanel({ bus, buses, etaMin, isFollowing, onFollow, onClose }: BusPanelProps) {
  const dayType = [0, 6].includes(new Date().getDay()) ? "weekend" : "weekday";
  const { data: freqData } = useGetRouteFrequency(bus.routeId, { dayType });

  const frequencyDisplay = useMemo(() => {
    const hour = new Date().getHours();
    const slot = getTimeSlot(hour);
    // freqData is a FrequencyData object {morning, afternoon, evening, night}
    const base = (freqData as Record<string, number> | undefined)?.[slot] ?? 6;

    const routeBuses = buses.filter((b) => b.routeId === bus.routeId && b.speed >= 5);
    const etaSeconds = routeBuses.map((b) => {
      const mps = b.speed * (1000 / 3600);
      return b.distanceToNextStop / mps;
    }).filter((s) => s > 0 && s < 3600);

    return fuseFrequency(base, etaSeconds);
  }, [freqRows, buses, bus.routeId]);

  const crowdLabel = CROWD_LABEL[bus.crowdLevel] ?? bus.crowdLevel;
  const crowdColor = CROWD_COLOR[bus.crowdLevel] ?? "#94a3b8";

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] w-[min(92vw,460px)] pointer-events-auto">
      <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: bus.routeColor }} />

        <div className="p-4 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center min-w-[58px] h-12 px-2.5 rounded-xl text-white font-display font-black text-lg leading-none shadow-md"
              style={{ background: bus.routeColor }}
            >
              {bus.routeNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Route</div>
              <div className="text-sm font-semibold text-foreground truncate">{bus.routeName}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="w-8 h-8 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats row: ETA · Crowd · Speed */}
          <div className="grid grid-cols-3 gap-2">
            <Stat
              icon={<Clock className="w-3.5 h-3.5" />}
              label="ETA"
              value={etaMin != null ? `${etaMin} min` : "Slow / stopped"}
            />
            <Stat
              icon={<Users className="w-3.5 h-3.5" />}
              label="Crowd"
              value={crowdLabel}
              valueColor={crowdColor}
            />
            <Stat
              icon={<Navigation className="w-3.5 h-3.5" />}
              label="Speed"
              value={`${Math.round(bus.speed)} km/h`}
            />
          </div>

          {/* Next stop */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/40 border border-border/40">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Next stop</div>
              <div className="text-sm font-semibold text-foreground truncate">{bus.nextStop}</div>
            </div>
            <Link
              href={`/routes/${bus.routeId}`}
              className="text-xs font-bold text-primary hover:text-primary/80 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1 flex-shrink-0"
            >
              <Bus className="w-3 h-3" />
              Details
            </Link>
          </div>

          {/* Frequency + Follow row */}
          <div className="flex items-center gap-2">
            {/* Frequency chip */}
            <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/40 border border-border/30">
              <Bus className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Freq</span>
              <span className="text-sm font-bold text-foreground tabular-nums ml-1">
                ~{frequencyDisplay.freq}/hr
              </span>
              {frequencyDisplay.isLive && (
                <span className="ml-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-1.5 py-0.5 leading-none">
                  live
                </span>
              )}
            </div>

            {/* Follow toggle button */}
            <button
              type="button"
              onClick={onFollow}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                isFollowing
                  ? "bg-primary text-primary-foreground border-primary/60 shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                  : "bg-secondary/40 text-muted-foreground border-border/30 hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isFollowing ? "animate-pulse" : ""}`} />
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border"
              style={{
                color: crowdColor,
                borderColor: `${crowdColor}40`,
                background: `${crowdColor}15`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: crowdColor }} />
              {crowdLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-border/30 bg-secondary/30 text-muted-foreground">
              {bus.busType}
            </span>
            {bus.depot && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-border/30 bg-secondary/30 text-muted-foreground">
                {bus.depot}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-border/30 bg-secondary/30 text-muted-foreground">
              {bus.stopsCovered ?? "?"} / {bus.totalStops ?? "?"} stops
            </span>
          </div>

          {bus.isLastBus && (
            <div className="bg-orange-500/15 border border-orange-500/30 rounded-lg px-3 py-2 text-center text-xs font-bold text-orange-400 uppercase tracking-wider">
              ⚠ Last bus tonight — board now
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================================================================================
// Main component
// ===================================================================================

export function LiveMap({
  buses = [],
  stops = [],
  mode = "all",
  userLat,
  userLng,
  fleetTotal,
  nearbyRadiusKm = 5,
}: LiveMapProps) {
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [trackedBusId, setTrackedBusId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [shapeTick, setShapeTick] = useState(0);

  const busesById = useMemo(() => {
    const m = new Map<string, LiveBus>();
    for (const b of buses) m.set(b.id, b);
    return m;
  }, [buses]);

  const selectedBus = selectedBusId ? busesById.get(selectedBusId) ?? null : null;
  const trackedBus = trackedBusId ? busesById.get(trackedBusId) ?? null : null;
  const selectedRouteId = (trackedBus ?? selectedBus)?.routeId ?? null;

  // Exit follow mode if tracked bus leaves viewport/service
  useEffect(() => {
    if (trackedBusId && !busesById.has(trackedBusId)) {
      setTrackedBusId(null);
    }
  }, [trackedBusId, busesById]);

  // Fetch route shape + stops when selection changes
  useEffect(() => {
    if (!selectedRouteId) return;
    if (routeDetailCache.has(selectedRouteId)) return;
    fetchRouteDetail(selectedRouteId).then(() => setShapeTick((t) => t + 1));
  }, [selectedRouteId]);

  const cached = selectedRouteId ? routeDetailCache.get(selectedRouteId) : undefined;
  const selectedShape = cached?.shape ?? null;
  void shapeTick;

  const visibleBuses = useMemo<LiveBus[]>(() => {
    if (!bounds) return buses.slice(0, MAX_VISIBLE_BUSES);
    const inBounds = buses.filter((b) => bounds.contains([b.lat, b.lng]));
    if (inBounds.length <= MAX_VISIBLE_BUSES) return inBounds;
    const c = bounds.getCenter();
    return inBounds
      .map((b) => ({ b, d: distanceSq(b.lat, b.lng, c.lat, c.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_VISIBLE_BUSES)
      .map((x) => x.b);
  }, [buses, bounds]);

  const selectedRouteStops = useMemo<BusStop[]>(() => {
    if (!selectedRouteId) return [];
    if (cached?.stops?.length) return cached.stops;
    return stops.filter((s) => s.routeIds?.includes(selectedRouteId));
  }, [cached, stops, selectedRouteId]);

  const currentStopId = useMemo<string | null>(() => {
    if (!selectedBus || !cached?.stops?.length) return null;
    const idx = cached.stops.findIndex((s) => s.id === selectedBus.nextStopId);
    if (idx <= 0) return null;
    return cached.stops[idx - 1].id;
  }, [selectedBus, cached]);

  const denominator = mode === "all" ? (fleetTotal ?? buses.length) : buses.length;
  const showingCaption = useMemo<string | null>(() => {
    if (visibleBuses.length === 0) return null;
    if (mode === "all") return `Showing ${visibleBuses.length} of ${denominator} buses`;
    if (buses.length > visibleBuses.length) return `Showing ${visibleBuses.length} of ${buses.length} nearby`;
    return null;
  }, [mode, visibleBuses.length, buses.length, denominator]);

  const nearbyFallback = useMemo<boolean>(() => {
    if (mode !== "nearby" || buses.length === 0) return false;
    if (typeof userLat !== "number" || typeof userLng !== "number") return false;
    return !buses.some((b) => haversineKm(userLat, userLng, b.lat, b.lng) <= nearbyRadiusKm);
  }, [mode, buses, userLat, userLng, nearbyRadiusKm]);

  const selectedEtaMin = useMemo(() => {
    if (!selectedBus) return null;
    return etaFromDistance(selectedBus.distanceToNextStop, selectedBus.speed);
  }, [selectedBus]);

  const handleClosePanel = () => {
    setSelectedBusId(null);
    setTrackedBusId(null);
  };

  const handleFollowToggle = () => {
    setTrackedBusId((prev) => (prev === selectedBusId ? null : selectedBusId));
  };

  return (
    <div className="w-full h-full relative z-10 bg-[#0f172a]">
      <MapContainer
        center={BANGALORE_CENTER}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        preferCanvas={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        />

        <ViewportTracker onBounds={setBounds} />
        <MapClickHandler onClick={handleClosePanel} />

        {/* Auto-focus: one-time flyTo on selection (does NOT activate follow mode) */}
        <AutoFocusBus bus={selectedBus} />

        {/* Follow mode: continuous panning, activated explicitly via button */}
        <BusFollower
          trackedBus={trackedBus}
          onUserDrag={() => setTrackedBusId(null)}
        />

        {/* Route polyline */}
        {selectedShape && selectedShape.length >= 2 && (
          <>
            <Polyline
              positions={selectedShape}
              pathOptions={{
                color: selectedBus?.routeColor || "#3b82f6",
                weight: 10,
                opacity: 0.18,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={selectedShape}
              pathOptions={{
                color: selectedBus?.routeColor || "#3b82f6",
                weight: 4,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        )}

        {/* Stop markers for selected route */}
        {selectedRouteStops.map((stop) => {
          const isNext = selectedBus?.nextStopId === stop.id;
          const isCurrent = currentStopId === stop.id;
          const highlight = isNext || isCurrent;
          return (
            <CircleMarker
              key={stop.id}
              center={[stop.lat, stop.lng]}
              radius={highlight ? 7 : 3.5}
              pathOptions={{
                color: isNext ? "#f59e0b" : isCurrent ? "#22c55e" : "#64748b",
                weight: highlight ? 3 : 1.25,
                fillColor: isNext ? "#fbbf24" : isCurrent ? "#4ade80" : "#1e293b",
                fillOpacity: highlight ? 1 : 0.6,
              }}
            />
          );
        })}

        {/* Bus markers */}
        {visibleBuses.map((bus) => {
          const isSelected = bus.id === selectedBusId;
          const dim = selectedBusId !== null && !isSelected;
          const color = bus.routeColor || "#3b82f6";
          const icon =
            bus.speed > 5
              ? getArrowIcon(color, bus.heading || 0, isSelected)
              : getDotIcon(color, isSelected);
          return (
            <Marker
              key={bus.id}
              position={[bus.lat, bus.lng]}
              icon={icon}
              opacity={dim ? 0.35 : 1}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  // Select the bus → triggers AutoFocusBus one-time flyTo.
                  // Follow mode is NOT activated here; user must click Follow.
                  setSelectedBusId(bus.id);
                  // Stop following a different bus if one was tracked
                  setTrackedBusId(null);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* Follow mode tracking banner */}
      {trackedBus && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] pointer-events-none">
          <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md border border-primary/40 rounded-full px-3.5 py-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
            <span className="text-xs font-semibold text-foreground">
              Tracking {trackedBus.routeNumber}
            </span>
            <span className="text-xs text-muted-foreground">• Drag map to stop</span>
          </div>
        </div>
      )}

      {/* "Showing X of Y" + nearby fallback */}
      {(showingCaption || nearbyFallback) && (
        <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-1.5 pointer-events-none">
          {showingCaption && (
            <div className="bg-card/80 backdrop-blur-md border border-border/50 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg">
              {showingCaption}
            </div>
          )}
          {nearbyFallback && (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-full px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-lg">
              No buses nearby • Showing nearest buses
            </div>
          )}
        </div>
      )}

      {/* Bus detail panel */}
      {selectedBus && (
        <BusPanel
          bus={selectedBus}
          buses={buses}
          etaMin={selectedEtaMin}
          isFollowing={trackedBusId === selectedBusId}
          onFollow={handleFollowToggle}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-secondary/40 border border-border/30 rounded-lg px-2.5 py-2 flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-bold truncate" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
    </div>
  );
}
