import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { api } from "../api/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// CSS hack to fix default Leaflet icon paths in production
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface TelemetryPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  date?: string;
}

interface Waypoint {
  name: string;
  latitude: number;
  longitude: number;
}

interface TelemetryData {
  active: boolean;
  mock?: boolean;
  message?: string;
  flightId?: string;
  sessionId?: string;
  callsign?: string;
  username?: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  verticalSpeed: number;
  heading: number;
  track: number;
  status: string;
  origin: string;
  destination: string;
  dep_lat: number;
  dep_lon: number;
  arr_lat: number;
  arr_lon: number;
  flownRoute: TelemetryPoint[];
  flightPlan: Waypoint[];
}

export default function LiveTracker() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAppSelector((s) => s.auth.user);
  
  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [isIdle, setIsIdle] = useState(false);

  // Refs for Map & Markers
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const aircraftMarker = useRef<L.Marker | null>(null);
  const depMarker = useRef<L.Marker | null>(null);
  const arrMarker = useRef<L.Marker | null>(null);
  const flownPolyline = useRef<L.Polyline | null>(null);
  const planPolyline = useRef<L.Polyline | null>(null);
  const isFirstLoad = useRef(true);
  const idleTimerRef = useRef<any>(null);

  // Determine booking ID: search query parameter or fallback to active user booking
  const bookingIdParam = searchParams.get("booking_id");
  const [resolvedBookingId, setResolvedBookingId] = useState<number | null>(
    bookingIdParam ? parseInt(bookingIdParam) : null
  );

  // Fetch user's active booking if booking ID is not passed
  useEffect(() => {
    if (bookingIdParam) return;
    
    const fetchActiveBooking = async () => {
      if (!user?.id) return;
      try {
        const bookings = await api.get<any[]>(`/bookings?pilot_id=${user.id}&status=booked`);
        const active = bookings.find((b) => b.status === "booked");
        if (active) {
          setResolvedBookingId(active.id);
        } else {
          setError("No active booked flight found to track. Go to Flight Operations to dispatch a booking.");
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load active booking.");
        setLoading(false);
      }
    };
    fetchActiveBooking();
  }, [user, bookingIdParam]);

  // Activity tracker for Idle Detection (15 mins timeout)
  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 15 * 60 * 1000); // 15 minutes
  };

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handleActivity = () => resetIdleTimer();

    events.forEach((e) => window.addEventListener(e, handleActivity));
    resetIdleTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Poll Telemetry Data
  useEffect(() => {
    if (!resolvedBookingId || isIdle) return;

    const fetchTelemetry = async () => {
      try {
        const data = await api.get<TelemetryData>(
          `/infinite-flight/live/track-booking/${resolvedBookingId}`
        );
        if (data.active) {
          setTelemetry(data);
          setError(null);
        } else {
          setError(data.message || "No active telemetry found for this flight.");
        }
      } catch (err: any) {
        console.error("Telemetry fetch error:", err);
        // Don't override existing telemetry state on polling errors to prevent screen flickering
        if (!telemetry) {
          setError(err.message || "Unable to fetch enroute telemetry.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000); // Enforced 15s interval

    return () => clearInterval(interval);
  }, [resolvedBookingId, isIdle]);

  // Leaflet Map Initialization & Rendering
  useEffect(() => {
    if (!telemetry || !mapRef.current) return;

    // Initialize Map if not created
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
      }).setView([telemetry.latitude, telemetry.longitude], 4);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstance.current);

      L.control.zoom({ position: "bottomright" }).addTo(mapInstance.current);
    }

    const map = mapInstance.current;

    // Setup Airport Markers
    const depLatLng: L.LatLngExpression = [telemetry.dep_lat, telemetry.dep_lon];
    const arrLatLng: L.LatLngExpression = [telemetry.arr_lat, telemetry.arr_lon];

    const airportIcon = (icao: string, label: string) =>
      L.divIcon({
        html: `<div class="flex flex-col items-center">
                 <div class="w-8 h-8 rounded-full bg-brand border border-white flex items-center justify-center text-white font-extrabold text-[10px] shadow-lg animate-pulse-slow">
                   ✈
                 </div>
                 <div class="bg-slate-900/90 text-white font-black text-[9px] px-1.5 py-0.5 rounded border border-brand-border mt-1 whitespace-nowrap shadow">
                   ${icao}
                 </div>
               </div>`,
        className: "custom-airport-marker",
        iconSize: [40, 50],
        iconAnchor: [20, 20],
      });

    if (!depMarker.current) {
      depMarker.current = L.marker(depLatLng, { icon: airportIcon(telemetry.origin, "DEP") })
        .addTo(map)
        .bindPopup(`<b>Origin: ${telemetry.origin}</b>`);
    } else {
      depMarker.current.setLatLng(depLatLng);
    }

    if (!arrMarker.current) {
      arrMarker.current = L.marker(arrLatLng, { icon: airportIcon(telemetry.destination, "ARR") })
        .addTo(map)
        .bindPopup(`<b>Destination: ${telemetry.destination}</b>`);
    } else {
      arrMarker.current.setLatLng(arrLatLng);
    }

    // Planned Path (Dashed)
    const planCoordinates = telemetry.flightPlan && telemetry.flightPlan.length > 0
      ? telemetry.flightPlan.map((wp) => [wp.latitude, wp.longitude] as L.LatLngExpression)
      : [depLatLng, arrLatLng];

    if (!planPolyline.current) {
      planPolyline.current = L.polyline(planCoordinates, {
        color: "#6366f1", // purpleindigo
        weight: 2,
        dashArray: "6, 6",
        opacity: 0.6,
      }).addTo(map);
    } else {
      planPolyline.current.setLatLngs(planCoordinates);
    }

    // Actual Flown Path (Solid)
    const flownCoordinates = telemetry.flownRoute.map(
      (pt) => [pt.latitude, pt.longitude] as L.LatLngExpression
    );
    // Add current position to close the gap
    flownCoordinates.push([telemetry.latitude, telemetry.longitude]);

    if (!flownPolyline.current) {
      flownPolyline.current = L.polyline(flownCoordinates, {
        color: "var(--color-brand, #a81f32)",
        weight: 3.5,
        opacity: 0.9,
      }).addTo(map);
    } else {
      flownPolyline.current.setLatLngs(flownCoordinates);
    }

    // Rotated Aircraft Icon
    const aircraftIconHtml = `
      <div class="relative" style="transform: rotate(${telemetry.heading}deg); transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);">
        <div class="absolute inset-0 w-10 h-10 -m-5 rounded-full bg-brand/10 border border-brand/20 animate-ping opacity-60"></div>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="var(--color-brand, #a81f32)" stroke="#ffffff" stroke-width="1" class="drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      </div>
    `;

    const aircraftIcon = L.divIcon({
      html: aircraftIconHtml,
      className: "custom-aircraft-marker",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const currentLatLng: L.LatLngExpression = [telemetry.latitude, telemetry.longitude];

    if (!aircraftMarker.current) {
      aircraftMarker.current = L.marker(currentLatLng, { icon: aircraftIcon })
        .addTo(map)
        .bindPopup(`<b>${telemetry.callsign}</b><br/>Pilot: ${telemetry.username}`);
    } else {
      aircraftMarker.current.setLatLng(currentLatLng);
      aircraftMarker.current.setIcon(aircraftIcon);
    }

    // Auto-fit bounds on first load
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      const bounds = L.latLngBounds([depLatLng, arrLatLng, currentLatLng]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 8 });
    }
  }, [telemetry]);

  // Cleanup Map on unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      aircraftMarker.current = null;
      depMarker.current = null;
      arrMarker.current = null;
      flownPolyline.current = null;
      planPolyline.current = null;
    };
  }, []);

  // Distance calculator helper (Haversine formula in NM)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3440.065; // Earth radius in NM
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const getETAString = (distLeft: number, gs: number) => {
    if (gs <= 50) return "Calculating...";
    const hours = distLeft / gs;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Calculations for HUD
  const distTotal = telemetry
    ? calculateDistance(telemetry.dep_lat, telemetry.dep_lon, telemetry.arr_lat, telemetry.arr_lon)
    : 0;
  const distRemaining = telemetry
    ? calculateDistance(telemetry.latitude, telemetry.longitude, telemetry.arr_lat, telemetry.arr_lon)
    : 0;
  const progressPct = distTotal > 0 ? Math.max(0, Math.min(100, Math.round(((distTotal - distRemaining) / distTotal) * 100))) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <button
            onClick={() => navigate("/operations")}
            className="text-xs font-bold text-gray-500 hover:text-brand flex items-center gap-1 mb-2 cursor-pointer transition-all"
          >
            ← Back to Flight Operations
          </button>
          <h1 className="text-4xl font-extrabold text-brand tracking-tight">Live Flight Tracker</h1>
          <p className="text-gray-500 text-sm mt-0.5">Enroute tracking telemetry powered by Infinite Flight Live API.</p>
        </div>

        {telemetry && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider animate-pulse-slow">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Live Telemetry
            </span>
            {telemetry.mock && (
              <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-black uppercase tracking-wider">
                Simulated Mock
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main UI Layout */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-brand-border/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm h-[600px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
          <p className="text-gray-500 text-sm font-semibold">Establishing telemetry connection...</p>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 rounded-3xl p-12 text-center text-gray-500 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-3xl mx-auto mb-4">
            ⚠
          </div>
          <p className="text-base font-bold text-gray-800 dark:text-gray-200">Tracking Offline</p>
          <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => navigate("/operations")}
            className="mt-6 bg-brand hover:bg-brand-dark text-white font-black text-xs px-6 py-3 rounded-2xl shadow transition-all cursor-pointer"
          >
            Return to Operations
          </button>
        </div>
      ) : telemetry ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map & Telemetry Details Map View */}
          <div className="lg:col-span-3 relative rounded-3xl overflow-hidden border border-brand-border/80 shadow-md h-[600px]">
            {/* Leaflet Map Div */}
            <div ref={mapRef} className="w-full h-full z-0" />

            {/* Float HUD Dashboard Overlay (Premium look & feel) */}
            <div className="absolute top-4 left-4 z-10 w-80 bg-slate-900/90 dark:bg-slate-990/90 backdrop-blur-md rounded-2xl border border-white/10 p-5 text-white shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div>
                  <span className="text-[9px] uppercase font-extrabold text-white/50 tracking-widest">Active Callsign</span>
                  <h4 className="text-lg font-black text-brand tracking-tight">{telemetry.callsign}</h4>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-extrabold text-white/50 tracking-widest">Status</span>
                  <p className="text-xs font-black uppercase text-emerald-400">{telemetry.status}</p>
                </div>
              </div>

              {/* Grid telemetry parameters */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Altitude</span>
                  <span className="text-sm font-black text-white">{telemetry.altitude.toLocaleString()} ft</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Speed (GS)</span>
                  <span className="text-sm font-black text-white">{telemetry.speed} kts</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Vert Speed</span>
                  <span className={`text-sm font-black ${telemetry.verticalSpeed > 200 ? "text-emerald-400" : telemetry.verticalSpeed < -200 ? "text-amber-400" : "text-white"}`}>
                    {telemetry.verticalSpeed > 0 ? "+" : ""}{telemetry.verticalSpeed.toLocaleString()} fpm
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider block">Heading</span>
                  <span className="text-sm font-black text-white">{Math.round(telemetry.heading)}°</span>
                </div>
              </div>

              {/* Progress & Route */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-[10px] text-white/60 font-extrabold">
                  <span>{telemetry.origin}</span>
                  <span className="text-brand font-black">{progressPct}% Complete</span>
                  <span>{telemetry.destination}</span>
                </div>
                
                {/* Custom Progress Bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-white/40 font-bold pt-1">
                  <span>Dist Remaining: <strong className="text-white font-extrabold">{distRemaining} NM</strong></span>
                  <span>ETA: <strong className="text-white font-extrabold">{getETAString(distRemaining, telemetry.speed)}</strong></span>
                </div>
              </div>
            </div>

            {/* Inactivity backdrop warning banner */}
            {isIdle && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                <div className="bg-slate-950/90 rounded-3xl border border-white/10 p-8 max-w-md shadow-2xl">
                  <span className="text-4xl">📡</span>
                  <h3 className="text-xl font-black text-white mt-4">Telemetry Polling Suspended</h3>
                  <p className="text-xs text-white/60 mt-2 leading-relaxed">
                    To respect the Infinite Flight Live V2 API query rates, tracking is paused during periods of user inactivity.
                  </p>
                  <button
                    onClick={() => resetIdleTimer()}
                    className="mt-6 w-full bg-brand hover:bg-brand-dark text-white font-black text-xs py-3.5 rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Resume Live Tracking
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Flight Plan Waypoints & Details */}
          <div className="bg-white dark:bg-slate-900 border border-brand-border/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-[600px] overflow-hidden">
            <div className="space-y-4 overflow-hidden flex flex-col h-full">
              <div className="border-b border-brand-border/40 pb-3 shrink-0">
                <h3 className="font-black text-brand text-sm tracking-tight">Active Flight Plan</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">List of waypoints filed inside the simulator.</p>
              </div>

              {/* Waypoints List Scroll container */}
              <div className="overflow-y-auto pr-1 space-y-2 flex-grow scrollbar-thin">
                {telemetry.flightPlan && telemetry.flightPlan.length > 0 ? (
                  telemetry.flightPlan.map((wp, idx) => {
                    const isOrigin = idx === 0;
                    const isDest = idx === telemetry.flightPlan.length - 1;
                    
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all text-xs ${
                          isOrigin || isDest
                            ? "bg-brand/5 border-brand/20 font-black text-brand"
                            : "bg-slate-50 dark:bg-slate-800/40 border-brand-border/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-bold font-mono">
                            {(idx + 1).toString().padStart(2, "0")}
                          </span>
                          <span className="font-extrabold uppercase">{wp.name}</span>
                        </div>
                        <span className="text-[9px] text-gray-400 font-mono font-semibold">
                          {wp.latitude.toFixed(3)}, {wp.longitude.toFixed(3)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-gray-400 text-xs italic">
                    No flight plan filed. Drawing great circle path directly between {telemetry.origin} and {telemetry.destination}.
                  </div>
                )}
              </div>
            </div>

            {/* Pilot Info Box */}
            <div className="mt-4 pt-4 border-t border-brand-border/40 shrink-0 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold">Discourse Pilot:</span>
                <span className="font-extrabold text-gray-800 dark:text-gray-200">{telemetry.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold">IF Flight ID:</span>
                <span className="font-extrabold font-mono text-[10px] text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                  {telemetry.flightId}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-brand-border p-12 text-center text-gray-500 rounded-3xl">
          <p className="text-base font-bold">No telemetry connection.</p>
        </div>
      )}
    </div>
  );
}
