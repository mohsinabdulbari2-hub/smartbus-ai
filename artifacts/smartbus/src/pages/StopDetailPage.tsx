import { useParams, Link } from "wouter";
import { useGetStopEta, useGetStopCrowd, useGetStops } from "@/hooks/use-smartbus";
import { Loader2, ArrowLeft, Bus, Users, MapPin, AlertCircle } from "lucide-react";
import { CrowdBadge, LastBusBadge } from "@/components/ui/badges";
import { formatMinutes } from "@/lib/utils";
import { motion } from "framer-motion";

export default function StopDetailPage() {
  const { id } = useParams<{ id: string }>();
  
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
      <div className="flex items-center justify-center h-full bg-background">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin"></div>
        </div>
      </div>
    );
  }

  const getCrowdColors = (level: string) => {
    switch (level) {
      case 'High': return 'from-destructive/30 to-destructive/5 text-destructive border-destructive/30';
      case 'Medium': return 'from-warning/30 to-warning/5 text-warning-foreground border-warning/30';
      default: return 'from-success/30 to-success/5 text-success border-success/30';
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Dark Gradient Hero */}
      <div className="bg-card border-b border-border shadow-xl z-20 shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50"></div>
        <div className="max-w-4xl mx-auto w-full p-6 md:p-8 relative z-10 flex items-start gap-5">
          <Link href="/" className="w-10 h-10 mt-1 shrink-0 rounded-full bg-secondary hover:bg-primary/20 flex items-center justify-center text-foreground hover:text-primary transition-colors border border-border">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 bg-accent/10 w-fit px-3 py-1 rounded-full border border-accent/20">
              <MapPin className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-widest text-accent">Bus Stop</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-foreground drop-shadow-sm mb-2">
              {stopInfo?.name || `Stop #${id}`}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Serving <strong className="text-foreground">{stopInfo?.routeIds?.length || 0}</strong> routes
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8 space-y-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
          
          {/* Crowd Prediction Card */}
          {crowd && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-card rounded-3xl p-6 md:p-8 shadow-xl border relative overflow-hidden flex flex-col md:flex-row items-start md:items-center gap-6 ${getCrowdColors(crowd.level).split(' ').filter(c=>c.includes('border')).join(' ')}`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r ${getCrowdColors(crowd.level).split(' ').filter(c=>c.includes('from') || c.includes('to')).join(' ')} opacity-50`}></div>
              
              <div className={`relative z-10 p-5 rounded-2xl bg-background shadow-inner border border-border/50 ${getCrowdColors(crowd.level).split(' ').find(c=>c.startsWith('text-'))}`}>
                <Users className={`w-10 h-10 ${crowd.level === 'High' ? 'animate-pulse' : ''}`} />
              </div>
              
              <div className="flex-1 relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-xl text-foreground">Station Crowd</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getCrowdColors(crowd.level).split(' ').find(c=>c.startsWith('text-'))} bg-background`}>
                    {crowd.level}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed font-medium">{crowd.reason}</p>
              </div>
              
              <div className="text-right w-full md:w-auto relative z-10 bg-background/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
                <div className="text-4xl font-display font-black tracking-tighter text-foreground">
                  {crowd.estimatedPassengers}
                </div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Est. People</div>
              </div>
            </motion.div>
          )}

          {/* Live Arrivals */}
          <div>
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="p-2 bg-primary/20 rounded-lg text-primary">
                <Bus className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-2xl tracking-tight">Live Arrivals</h2>
              <div className="ml-auto flex items-center gap-2 text-xs font-bold text-success bg-success/10 px-4 py-2 rounded-full border border-success/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                </span>
                LIVE
              </div>
            </div>

            {!etas || etas.length === 0 ? (
              <div className="bg-card rounded-3xl p-16 text-center border border-border border-dashed shadow-inner">
                <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-30" />
                <h3 className="text-2xl font-bold text-foreground">No buses scheduled</h3>
                <p className="text-muted-foreground mt-2 font-medium">There are no incoming buses for this stop at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {etas.map((eta, index) => {
                  const isDue = eta.etaMinutes === 0;
                  return (
                    <motion.div 
                      key={`${eta.busId}-${index}`}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-card p-5 md:p-6 rounded-2xl shadow-lg border flex flex-col md:flex-row md:items-center gap-5 transition-all relative overflow-hidden group ${isDue ? 'border-primary shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'border-border/50 hover:border-border'}`}
                    >
                      {isDue && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse"></div>
                      )}
                      
                      <div className="flex items-center gap-5 flex-1">
                        <div 
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0"
                          style={{ backgroundColor: eta.routeColor || 'var(--color-primary)' }}
                        >
                          {eta.routeNumber}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-foreground truncate mb-2">{eta.routeName}</h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CrowdBadge level={eta.crowdLevel} />
                            {eta.isLastBus && <LastBusBadge />}
                          </div>
                        </div>
                      </div>

                      {/* Right side - ETA Clock */}
                      <div className={`shrink-0 flex flex-col items-end md:items-center justify-center min-w-[100px] p-3 rounded-xl ${isDue ? 'bg-primary/10' : 'bg-secondary/50'}`}>
                        <div className={`text-4xl font-display font-black tracking-tighter ${isDue ? 'text-primary animate-pulse drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'text-foreground'}`}>
                          {isDue ? 'DUE' : eta.etaMinutes}
                        </div>
                        {!isDue && (
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                            MINUTES
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
