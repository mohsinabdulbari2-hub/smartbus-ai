const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export type LiveBus = {
  id: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  routeColor: string;
  lat: number;
  lng: number;
  speed: number;
  crowdLevel: "Low" | "Medium" | "High";
  nextStop: string;
  nextStopId: string;
  isLastBus: boolean;
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
};

export type RouteDetail = Route & {
  stops: { id: string; name: string }[];
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
  crowdLevel: "Low" | "Medium" | "High";
  isLastBus: boolean;
};

export type CrowdInfo = {
  stopId: string;
  level: "Low" | "Medium" | "High";
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
  crowdLevel: "Low" | "Medium" | "High";
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
  getRouteFrequency: (id: string) => get<FrequencyData>(`/routes/${id}/frequency`),
  getStops: () => get<BusStop[]>("/stops"),
  getStopEta: (id: string) => get<EtaEntry[]>(`/stops/${id}/eta`),
  getStopCrowd: (id: string) => get<CrowdInfo>(`/stops/${id}/crowd`),
  searchRoutes: (source: string, destination: string) =>
    get<SearchResult[]>(`/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`),
};
