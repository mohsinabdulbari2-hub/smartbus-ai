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
} from "@workspace/api-client-react";

/**
 * Wrapper hooks to inject global configurations like polling
 * and handle unified error logging if necessary.
 */

export function useLiveBusesPolling() {
  // Poll live buses every 8s — smooth enough for map movement without thrashing
  // markers or hammering the server. Keeps previous frame mounted while refetching.
  return useGetLiveBuses({
    query: {
      queryKey: getGetLiveBusesQueryKey(),
      refetchInterval: 8000,
      staleTime: 4000,
    }
  });
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
