import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { FuelStation } from '../types';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Droplets, Activity } from 'lucide-react';
import TrafficBar from './TrafficBar';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (color: string) => {
  return new L.DivIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const greenIcon = createCustomIcon('#22c55e'); // Green for active/has fuel
const redIcon = createCustomIcon('#ef4444'); // Red for inactive/no fuel

function MapInteractionController() {
  const map = useMap();
  const [showMessage, setShowMessage] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if touch device
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    // Disable dragging initially for touch devices
    map.dragging.disable();

    const container = map.getContainer();

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        map.dragging.enable();
      } else {
        map.dragging.disable();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // User is trying to move with one finger
        setShowMessage(true);
        
        // Clear existing timer
        if (timerRef.current) clearTimeout(timerRef.current);
        
        // Hide after 1.5 seconds
        timerRef.current = setTimeout(() => {
          setShowMessage(false);
        }, 1500);
      }
    };

    const handleTouchEnd = () => {
      // We don't immediately disable here to allow momentum if needed, 
      // but for strict 2-finger control, we disable.
      // Leaflet handles momentum, but if we disable dragging, it stops.
      // Let's disable to be safe and consistent.
      map.dragging.disable();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [map]);

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-[1000] transition-opacity duration-300 ${showMessage ? 'opacity-100' : 'opacity-0'}`}>
      <div className="bg-black/80 text-white px-6 py-3 rounded-full text-sm font-bold backdrop-blur-md shadow-lg transform transition-transform duration-300">
        Use two fingers to move the map
      </div>
    </div>
  );
}

export function LiveMap() {
  const [stations, setStations] = useState<FuelStation[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'stations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelStation));
      setStations(stationData);
    }, (error) => {
      console.error("LiveMap Firestore Error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Center of Northern Province, Sri Lanka
  const defaultCenter: [number, number] = [9.6615, 80.0255];

  return (
    <div className="h-[500px] w-full rounded-3xl overflow-hidden border border-[#141414]/10 shadow-xl relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={9} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <MapInteractionController />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {stations.map(station => {
          if (!station.lat || !station.lng) return null;

          const totalFuel = station.balance_petrol_92 + station.balance_petrol_95 + station.balance_diesel + station.balance_super_diesel;
          const hasFuel = totalFuel > 0;
          const icon = hasFuel ? greenIcon : redIcon;

          return (
            <Marker 
              key={station.id} 
              position={[station.lat, station.lng]} 
              icon={icon}
            >
              <Popup className="rounded-2xl">
                <div className="p-2 min-w-[200px]">
                  <h3 className="font-bold text-lg mb-1">{station.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{station.location}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">Total Fuel</span>
                      </div>
                      <span className="text-sm font-bold">{totalFuel.toLocaleString()}L</span>
                    </div>

                    <div className="bg-gray-50 p-2 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">Traffic</span>
                      </div>
                      <TrafficBar level={station.traffic_level || 0} />
                      <span className="text-xs font-bold block mt-1">{station.traffic_level || 0}%</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <div className="opacity-50 mb-1">P92</div>
                      <div className="font-bold">{station.balance_petrol_92}L</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <div className="opacity-50 mb-1">P95</div>
                      <div className="font-bold">{station.balance_petrol_95}L</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <div className="opacity-50 mb-1">Diesel</div>
                      <div className="font-bold">{station.balance_diesel}L</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <div className="opacity-50 mb-1">S.Diesel</div>
                      <div className="font-bold">{station.balance_super_diesel}L</div>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
