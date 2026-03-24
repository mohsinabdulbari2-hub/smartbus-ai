import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Bus, MapPin } from "lucide-react";
import { renderToString } from "react-dom/server";
import { Link } from "wouter";
import { LiveBus, BusStop } from "@workspace/api-client-react";
import { formatMinutes } from "@/lib/utils";

interface LiveMapProps {
  buses?: LiveBus[];
  stops?: BusStop[];
}

const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];

// Setup custom icons
const createBusIcon = (bus: LiveBus) => {
  const isHighCrowd = bus.crowdLevel === "High";
  const color = isHighCrowd ? "#ef4444" : bus.routeColor || "#1e293b";
  
  const iconHtml = renderToString(
    <div className="relative">
      <div 
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${bus.isLastBus ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: color }}
      >
        <Bus className="w-5 h-5 text-white" />
      </div>
      {bus.isLastBus && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white text-white text-[10px] font-bold">
          !
        </div>
      )}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "bus-marker-container",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

const createStopIcon = () => {
  return L.divIcon({
    html: '<div class="stop-marker-dot"></div>',
    className: "",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6],
  });
};

export function LiveMap({ buses = [], stops = [] }: LiveMapProps) {
  return (
    <div className="w-full h-full relative bg-gray-100 z-10">
      <MapContainer 
        center={BANGALORE_CENTER} 
        zoom={13} 
        className="w-full h-full"
        zoomControl={false}
      >
        {/* Modern clean light map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {stops.map(stop => (
          <Marker 
            key={stop.id} 
            position={[stop.lat, stop.lng]} 
            icon={createStopIcon()}
          >
            <Popup className="rounded-xl overflow-hidden shadow-xl border-0">
              <div className="p-1 min-w-[200px]">
                <h3 className="font-display font-bold text-lg">{stop.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">Routes: {stop.routeIds?.join(", ")}</p>
                <Link 
                  href={`/stops/${stop.id}`}
                  className="mt-3 block w-full text-center bg-primary text-white py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  View Live ETAs
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
          >
            <Popup className="rounded-xl overflow-hidden shadow-xl border-0 p-0">
              <div className="p-0 min-w-[220px]">
                <div className="p-3 text-white" style={{ backgroundColor: bus.routeColor || '#1e293b' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-xl">{bus.routeNumber}</span>
                      <p className="text-xs opacity-90 truncate max-w-[140px]">{bus.routeName}</p>
                    </div>
                    {bus.isLastBus && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">LAST</span>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-white">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Next Stop:</span>
                    <span className="text-sm font-semibold text-right">{bus.nextStop}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-muted-foreground">Speed:</span>
                    <span className="text-sm font-semibold">{bus.speed} km/h</span>
                  </div>
                  
                  <Link 
                    href={`/routes/${bus.routeId}`}
                    className="block w-full text-center bg-secondary text-foreground py-2 rounded-lg text-sm font-semibold hover:bg-secondary/80 transition-colors"
                  >
                    View Route Details
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
