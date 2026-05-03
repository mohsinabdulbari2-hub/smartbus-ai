const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export type BusType = "Ordinary" | "Vajra" | "Volvo" | "Airport" | "MetroFeeder" | "Night";

export type CrowdLevel = "Low" | "Medium" | "High" | "VeryHigh";

export type LiveBus = {
  id: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeColor: string;
  busType: BusType;
  depot: string | null;
  lat: number;
  lng: number;
  speed: number;
  crowdLevel: CrowdLevel;
  nextStop: string;
  nextStopId: string;
  isLastBus: boolean;
  isOnline?: boolean;
  totalStops: number;
  stopsCovered: number;
  stopsRemaining: number;
  currentStop: string;
};

export type BusStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  routeIds: string[];
};

export type Route = {
  id: string;
  number: string;
  name: string;
  from: string;
  to: string;
  color: string;
  totalStops: number;
  lastBusTime?: string;
  busType: BusType;
  depot?: string;
  distance?: number;
};

export type StopLiveStatus = "Departed" | "AtStop" | "Upcoming";

export type RouteStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  liveStatus?: StopLiveStatus;
  etaMinutes?: number | null;
  isNextStop?: boolean;
};

export type RouteDetail = Route & {
  stops: RouteStop[];
};

export type FrequencyData = {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
  dayType: string;
};

export type EtaEntry = {
  busId: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeColor: string;
  etaMinutes: number;
  crowdLevel: CrowdLevel;
  isLastBus: boolean;
};

export type CrowdInfo = {
  stopId: string;
  level: CrowdLevel;
  estimatedPassengers: number;
  reason: string;
};

export type SearchResult = {
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeColor: string;
  sourceStop: string;
  destinationStop: string;
  etaMinutes: number;
  crowdLevel: CrowdLevel;
  isLastBus: boolean;
  frequency: number;
  stopCount: number;
  tags: string[];
  isRecommended: boolean;
  isFastest: boolean;
  isLeastCrowded: boolean;
};

export const api = {
  getLiveBuses: () => get<LiveBus[]>("/buses/live"),
  getRoutes: () => get<Route[]>("/routes"),
  getRoute: (id: string) => get<RouteDetail>(`/routes/${id}`),
  getRouteFrequency: (id: string, dayType: "weekday" | "weekend" = "weekday") =>
    get<FrequencyData>(`/routes/${id}/frequency?dayType=${dayType}`),
  getStops: () => get<BusStop[]>("/stops"),
  getStopEta: (id: string) => get<EtaEntry[]>(`/stops/${id}/eta`),
  getStopCrowd: (id: string) => get<CrowdInfo>(`/stops/${id}/crowd`),
  searchRoutes: (source: string, destination: string) =>
    get<SearchResult[]>(`/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`),
};
