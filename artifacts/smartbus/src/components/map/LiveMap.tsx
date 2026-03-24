import { renderToString } from "react-dom/server";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Bus, Clock } from "lucide-react";
import { Link } from "wouter";
import { LiveBus, BusStop } from "@workspace/api-client-react";
import { CrowdBadge } from "@/components/ui/badges";

interface LiveMapProps {
  buses?: LiveBus[];
  stops?: BusStop[];
}

const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];

// Custom Bus Icon: Pill shaped
const createBusIcon = (bus: LiveBus) => {
  const color = bus.routeColor || "#3b82f6"; // fallback to blue-500
  const isHigh = bus.crowdLevel === "High";
  const crowdDotColor = isHigh ? "#ef4444" : bus.crowdLevel === "Medium" ? "#f59e0b" : "#22c55e";
  
  const iconHtml = renderToString(
    <div className="relative group">
      <div 
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.4)] border-[1.5px] border-white/20 backdrop-blur-md transition-transform ${bus.isLastBus ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: color }}
      >
        <Bus className="w-3.5 h-3.5 text-white" />
        <span className="text-white font-bold text-sm tracking-tight">{bus.routeNumber}</span>
      </div>
      {/* Tiny Crowd Dot */}
      <div 
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: crowdDotColor }}
      />
      {bus.isLastBus && (
        <div className="absolute -bottom-2 inset-x-0 flex justify-center">
          <div className="bg-orange-500 w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#f97316]"></div>
        </div>
      )}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "bg-transparent border-0",
    iconSize: [60, 32],
    iconAnchor: [30, 16],
    popupAnchor: [0, -20],
  });
};

// Custom Stop Icon
const createStopIcon = () => {
  return L.divIcon({
    html: '<div class="w-4 h-4 bg-white border-[4px] border-[#3b82f6] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.4)]"></div>',
    className: "bg-transparent border-0",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
};

export function LiveMap({ buses = [], stops = [] }: LiveMapProps) {
  return (
    <div className="w-full h-full relative z-10 bg-[#0f172a]">
      <MapContainer 
        center={BANGALORE_CENTER} 
        zoom={13} 
        className="w-full h-full"
        zoomControl={false}
      >
        {/* Dark map tiles matching theme */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {stops.map(stop => (
          <Marker 
            key={stop.id} 
            position={[stop.lat, stop.lng]} 
            icon={createStopIcon()}
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="bg-card border border-border/50 rounded-2xl shadow-2xl p-4 min-w-[200px] backdrop-blur-xl">
                <h3 className="font-display font-bold text-foreground text-lg mb-1">{stop.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 font-medium">Routes: <span className="text-foreground">{stop.routeIds?.length || 0}</span> serving here</p>
                <Link 
                  href={`/stops/${stop.id}`}
                  className="w-full flex items-center justify-center gap-2 bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground py-2.5 rounded-xl text-sm font-bold transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  View ETAs →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}

        {buses.map(bus => (
          <Marker 
            key={bus.id} 
            position={[bus.lat, bus.lng]} 
            icon={createBusIcon(bus)}
            zIndexOffset={1000}
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden min-w-[240px] flex flex-col">
                {/* Header */}
                <div 
                  className="p-4 flex flex-col relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${bus.routeColor} 0%, rgba(30,41,59,0.9) 100%)` }}
                >
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <span className="font-display font-black text-3xl text-white drop-shadow-md">{bus.routeNumber}</span>
                      <p className="text-white/90 text-sm font-medium leading-tight max-w-[160px] truncate mt-1">{bus.routeName}</p>
                    </div>
                  </div>
                </div>

                {/* Last Bus Warning */}
                {bus.isLastBus && (
                  <div className="bg-primary px-4 py-2 flex items-center justify-center gap-2 animate-pulse">
                    <span className="text-white font-bold text-xs uppercase tracking-widest">⚠️ LAST BUS - Board Now!</span>
                  </div>
                )}

                {/* Body */}
                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Next Stop</div>
                    <div className="text-sm font-semibold text-foreground truncate">{bus.nextStop}</div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Speed</span>
                      <span className="text-sm font-semibold text-foreground">{Number(bus.speed).toFixed(1)} km/h</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${Math.min((Number(bus.speed) / 60) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                    <CrowdBadge level={bus.crowdLevel} />
                    <Link href={`/routes/${bus.routeId}`} className="text-xs font-bold text-accent hover:text-accent/80 transition-colors">
                      Route Info →
                    </Link>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
