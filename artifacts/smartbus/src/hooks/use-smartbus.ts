import {
  useGetLiveBuses,
  getGetLiveBusesQueryKey,
  useGetRoutes,
  useGetStops,
  useSearchRoutes,
  useGetRoute,
  useGetRouteFrequency,
  useGetStopEta,
  useGetStopCrowd,
  type GetLiveBusesParams,
} from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/**
 * Wrapper hooks to inject global configurations like polling
 * and handle unified error logging if necessary.
 */

export function useLiveBusesPolling(params?: GetLiveBusesParams) {
  // Poll live buses every 8s — smooth enough for map movement without thrashing
  // markers or hammering the server. `keepPreviousData` prevents the map from
  // flashing empty when the user toggles between Nearby and All modes (the new
  // request flies in the background while the previous markers stay rendered).
  return useGetLiveBuses(params, {
    query: {
      queryKey: getGetLiveBusesQueryKey(params),
      refetchInterval: 8000,
      staleTime: 4000,
      placeholderData: keepPreviousData,
    },
  });
}

/**
 * Fetch the X-Total-Count header from /api/buses/live so the UI can render
 * "Showing X of Y" using the *real* fleet size — the JSON body itself is
 * always capped at 100 items by the backend. Polled slowly (60s) since the
 * fleet size barely changes.
 */
export function useFleetTotal(): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/buses/live?limit=1", { method: "GET" });
        const header = res.headers.get("X-Total-Count");
        if (alive && header) {
          const n = parseInt(header, 10);
          if (Number.isFinite(n)) setTotal(n);
        }
      } catch {
        /* swallow — header is informational only */
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return total;
}

// Re-export standard queries for easier imports across the app
export {
  useGetRoutes,
  useGetStops,
  useSearchRoutes,
  useGetRoute,
  useGetRouteFrequency,
  useGetStopEta,
  useGetStopCrowd,
};
