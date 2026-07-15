import { useEffect, useState, useRef } from "react";

interface PaxBoardingModalProps {
  isOpen: boolean;
  finalPaxCount: number | null;
  aircraftIcao?: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  seatCapacity?: number;
  onComplete: () => void;
}

type Phase = "checking" | "boarding" | "seating" | "complete";

export default function PaxBoardingModal({
  isOpen,
  finalPaxCount,
  aircraftIcao,
  flightNumber,
  origin,
  destination,
  seatCapacity = 300,
  onComplete,
}: PaxBoardingModalProps) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [displayCount, setDisplayCount] = useState(0);
  const [seatedCount, setSeatedCount] = useState(0);
  const [shimmer, setShimmer] = useState(false);
  const countIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phase driver
  useEffect(() => {
    if (!isOpen || finalPaxCount === null) return;

    setPhase("checking");
    setDisplayCount(0);
    setSeatedCount(0);
    setShimmer(false);

    // Phase 1: "Checking Manifest..." → 1.2s
    const t1 = setTimeout(() => {
      setPhase("boarding");

      // Phase 2: Odometer counter 0 → finalPaxCount over ~1.8s
      const duration = 1800;
      const steps = 60;
      const increment = finalPaxCount / steps;
      let current = 0;
      countIntervalRef.current = setInterval(() => {
        current += increment;
        if (current >= finalPaxCount) {
          current = finalPaxCount;
          clearInterval(countIntervalRef.current!);

          // Phase 3: Seating animation → starts immediately
          const t3 = setTimeout(() => {
            setPhase("seating");
            let seated = 0;
            const seatTotal = Math.min(finalPaxCount, seatCapacity);
            seatIntervalRef.current = setInterval(() => {
              seated += Math.ceil(seatTotal / 20);
              if (seated >= seatTotal) {
                seated = seatTotal;
                clearInterval(seatIntervalRef.current!);

                // Phase 4: Complete reveal
                const t4 = setTimeout(() => {
                  setPhase("complete");
                  setShimmer(true);
                }, 400);
                return () => clearTimeout(t4);
              }
              setSeatedCount(seated);
            }, 80);
            return () => clearInterval(seatIntervalRef.current!);
          }, 300);
          return () => clearTimeout(t3);
        }
        setDisplayCount(Math.round(current));
      }, duration / steps);
    }, 1200);

    return () => {
      clearTimeout(t1);
      if (countIntervalRef.current) clearInterval(countIntervalRef.current);
      if (seatIntervalRef.current) clearInterval(seatIntervalRef.current);
    };
  }, [isOpen, finalPaxCount]);

  if (!isOpen) return null;

  const loadFactor = finalPaxCount !== null && seatCapacity > 0
    ? Math.round((finalPaxCount / seatCapacity) * 100)
    : 0;

  // Seat grid — 60 "seat" blocks representing the cabin
  const gridTotal = 60;
  const filledSeats = phase === "seating" || phase === "complete"
    ? Math.round((seatedCount / Math.min(finalPaxCount || 1, seatCapacity)) * gridTotal)
    : 0;
  const completedSeats = phase === "complete"
    ? Math.round((finalPaxCount! / seatCapacity) * gridTotal)
    : filledSeats;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md mx-4 rounded-3xl overflow-hidden shadow-2xl transition-all duration-700 ${
          phase === "complete"
            ? "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-black/20"
            : "border border-white/10"
        }`}
        style={{
          background: "linear-gradient(145deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
        }}
      >
        {/* Shimmer overlay on complete */}
        {shimmer && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(105deg, transparent 40%, rgba(251,191,36,0.12) 50%, transparent 60%)",
              animation: "shimmer 1.8s ease-in-out infinite",
            }}
          />
        )}

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all duration-500 ${
              phase === "complete" ? "bg-amber-400/20 ring-2 ring-amber-400/40" : "bg-brand/20"
            }`}>
              {phase === "checking" ? "📋" : phase === "boarding" ? "🚶" : phase === "seating" ? "💺" : "✅"}
            </div>
            <div>
              <h2 className="text-white font-black text-sm tracking-wide uppercase">
                {phase === "checking" && "Generating Manifest…"}
                {phase === "boarding" && "Boarding Passengers"}
                {phase === "seating" && "Seating Passengers"}
                {phase === "complete" && "Manifest Complete"}
              </h2>
              {(origin || destination) && (
                <p className="text-white/40 text-[10px] font-mono mt-0.5">
                  {flightNumber} · {origin} → {destination} · {aircraftIcao}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Phase 1: spinner */}
          {phase === "checking" && (
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 border-4 border-brand/20 rounded-full" />
                <div
                  className="absolute inset-0 border-4 border-transparent border-t-brand rounded-full"
                  style={{ animation: "spin 0.9s linear infinite" }}
                />
              </div>
              <p className="text-white/60 text-xs font-medium">Checking seat availability and manifest…</p>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-brand/60 rounded-full"
                    style={{ animation: `bounce 1s ease-in-out ${i * 0.18}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Phase 2 + 3 + 4: Pax counter */}
          {(phase === "boarding" || phase === "seating" || phase === "complete") && (
            <>
              {/* Odometer counter */}
              <div className="text-center">
                <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Passengers Boarded</div>
                <div
                  className={`font-black tabular-nums transition-all duration-300 ${
                    phase === "complete"
                      ? "text-7xl text-amber-400"
                      : "text-6xl text-white"
                  }`}
                  style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
                >
                  {phase === "complete" ? finalPaxCount : displayCount}
                </div>
                <div className="text-white/30 text-xs mt-1 font-medium">
                  of {seatCapacity} seat capacity · {loadFactor}% load factor
                </div>
              </div>

              {/* Load factor bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-white/40 font-medium">
                  <span>Cabin Load</span>
                  <span className={phase === "complete" ? "text-amber-400 font-black" : ""}>{loadFactor}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      phase === "complete"
                        ? "bg-gradient-to-r from-amber-500 to-amber-300"
                        : "bg-gradient-to-r from-brand to-indigo-400"
                    }`}
                    style={{
                      width: `${Math.min(loadFactor, 100)}%`,
                      transition: "width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  />
                </div>
              </div>

              {/* Seat map grid (Phase 3 + 4) */}
              {(phase === "seating" || phase === "complete") && (
                <div className="space-y-2">
                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Cabin Map</div>
                  <div
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: "repeat(12, 1fr)" }}
                  >
                    {Array.from({ length: gridTotal }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-3 rounded-sm transition-all duration-200 ${
                          i < completedSeats
                            ? phase === "complete"
                              ? "bg-amber-400/80"
                              : "bg-brand/70"
                            : "bg-white/10"
                        }`}
                        style={{
                          transitionDelay: `${Math.random() * 0.3}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3 text-[9px] text-white/30 font-medium">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-sm inline-block ${phase === "complete" ? "bg-amber-400/80" : "bg-brand/70"}`} />
                      Occupied
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm inline-block bg-white/10" />
                      Empty
                    </span>
                  </div>
                </div>
              )}

              {/* Phase 4: Stats reveal */}
              {phase === "complete" && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    { label: "Pax Boarded", value: String(finalPaxCount), icon: "👥" },
                    { label: "Load Factor", value: `${loadFactor}%`, icon: "📊" },
                    {
                      label: "Status",
                      value: loadFactor >= 80 ? "Full" : loadFactor >= 60 ? "High" : "Normal",
                      icon: loadFactor >= 80 ? "🔴" : loadFactor >= 60 ? "🟡" : "🟢",
                    },
                  ].map(({ label, value, icon }) => (
                    <div
                      key={label}
                      className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center"
                    >
                      <div className="text-lg">{icon}</div>
                      <div className="text-white font-black text-sm mt-1">{value}</div>
                      <div className="text-white/30 text-[9px] font-medium mt-0.5 uppercase tracking-wider">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CTA: only on complete */}
          {phase === "complete" && (
            <button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-amber-500/25 text-sm cursor-pointer"
            >
              ✈️ Proceed to Flight Planning
            </button>
          )}
        </div>
      </div>

      {/* Global keyframe styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
      `}</style>
    </div>
  );
}
