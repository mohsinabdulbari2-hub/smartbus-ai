import {
  useGetLiveBuses,
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
  // Poll live buses every 3 seconds for real-time map movement
  return useGetLiveBuses({
    query: {
      refetchInterval: 3000,
      staleTime: 1000,
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
