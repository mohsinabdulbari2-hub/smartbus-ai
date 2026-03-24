import { useParams, Link } from "wouter";
import { useGetStopEta, useGetStopCrowd, useGetStops } from "@/hooks/use-smartbus";
import { Loader2, ArrowLeft, Bus, Users, MapPin, AlertCircle } from "lucide-react";
import { CrowdBadge, LastBusBadge } from "@/components/ui/badges";
import { formatMinutes } from "@/lib/utils";
import { motion } from "framer-motion";

export default function StopDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  // Get stop name by fetching all stops (in real app, would have specific GET /api/stops/:id)
  const { data: stops } = useGetStops();
  const stopInfo = stops?.find(s => s.id === id);

  const { data: etas, isLoading: etasLoading } = useGetStopEta(id || "", { 
    query: { enabled: !!id, refetchInterval: 5000 } 
  });
  
  const { data: crowd, isLoading: crowdLoading } = useGetStopCrowd(id || "", { 
    query: { enabled: !!id } 
  });

  if (etasLoading || crowdLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      <div className="bg-card border-b border-border/50 sticky top-0 z-20 shadow-sm p-4 md:p-6">
        <div className="max-w-4xl mx-auto w-full flex items-start gap-4">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors mt-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 text-accent">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Bus Stop</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              {stopInfo?.name || `Stop #${id}`}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Serving {stopInfo?.routeIds?.length || 0} routes
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Crowd Prediction Card */}
        {crowd && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-3xl p-6 shadow-xl shadow-black/5 border border-border/50 flex flex-col md:flex-row items-start md:items-center gap-6"
          >
            <div className={`p-4 rounded-2xl ${
              crowd.level === 'High' ? 'bg-destructive/10 text-destructive' :
              crowd.level === 'Medium' ? 'bg-warning/20 text-warning-foreground' :
              'bg-success/15 text-success'
            }`}>
              <Users className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Station Crowd Prediction</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{crowd.reason}</p>
            </div>
            <div className="text-right w-full md:w-auto">
              <div className="text-3xl font-black font-display tracking-tighter">
                {crowd.estimatedPassengers}
              </div>
              <div className="text-xs font-bold text-muted-foreground uppercase">Est. People</div>
            </div>
          </motion.div>
        )}

        {/* Live Arrivals */}
        <div>
          <div className="flex items-center gap-2 mb-6 px-1">
            <Bus className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-xl">Live Arrivals</h2>
            <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-success bg-success/10 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              LIVE
            </div>
          </div>

          {!etas || etas.length === 0 ? (
            <div className="bg-card rounded-3xl p-12 text-center border border-border/50 border-dashed">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold">No buses scheduled</h3>
              <p className="text-muted-foreground mt-2">There are no incoming buses for this stop at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {etas.map((eta, index) => (
                <motion.div 
                  key={`${eta.busId}-${index}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card p-5 rounded-2xl shadow-lg shadow-black/5 border border-border/50 flex items-center gap-4 hover:border-primary/30 transition-all group cursor-pointer"
                >
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md shrink-0"
                    style={{ backgroundColor: eta.routeColor || 'var(--color-primary)' }}
                  >
                    {eta.routeNumber}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-foreground truncate">{eta.routeName}</h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <CrowdBadge level={eta.crowdLevel} />
                      {eta.isLastBus && <LastBusBadge />}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-3xl font-black ${eta.etaMinutes <= 2 ? 'text-accent animate-pulse' : 'text-primary'}`}>
                      {eta.etaMinutes === 0 ? 'Due' : eta.etaMinutes}
                    </div>
                    <div className="text-xs font-bold text-muted-foreground">
                      {eta.etaMinutes === 0 ? 'NOW' : 'MIN'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
