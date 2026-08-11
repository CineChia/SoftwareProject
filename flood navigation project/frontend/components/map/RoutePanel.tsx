"use client";

import { useEffect, useRef, useState } from "react";
import { Bike, Car, Footprints, LocateFixed, Loader2, MapPin, ShieldAlert, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { geocodePlace, getCurrentPosition, reverseGeocode } from "@/lib/map/routing";
import { PAPER } from "@/lib/map/paper-theme";
import { TRAVEL_MODE_OPTIONS, type RoutePoint, type TravelMode } from "@/lib/map/types";
import { useRouteStore } from "@/lib/store/useRouteStore";
import { cn } from "@/lib/utils";

const MODE_ICON: Record<TravelMode, typeof Bike> = {
  walk: Footprints,
  bike: Bike,
  car: Car,
};

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

/** A single search box that turns typed text into a picked RoutePoint */
function LocationField({
  placeholder,
  value,
  onSelect,
  allowCurrentLocation = false,
}: {
  placeholder: string;
  value: RoutePoint | null;
  onSelect: (point: RoutePoint | null) => void;
  /** Shows a "use my current location" button inside the field */
  allowCurrentLocation?: boolean;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<RoutePoint[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleUseCurrentLocation() {
    setLocating(true);
    setLocateError(null);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      const point = await reverseGeocode(latitude, longitude);
      onSelect(point);
      setQuery(point.label);
      setResults([]);
      setOpen(false);
    } catch (err) {
      setLocateError(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value]);

  function handleChange(next: string) {
    setQuery(next);
    onSelect(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await geocodePlace(next));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div className="relative w-full">
      <div
        className="flex items-center gap-2 rounded-xl border-2 px-3 py-2"
        style={{ borderColor: PAPER.ink, backgroundColor: PAPER.edge }}
      >
        <MapPin className="size-4 shrink-0" style={{ color: PAPER.shadow }} />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          style={{ color: PAPER.ink }}
        />
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin" style={{ color: PAPER.shadow }} /> : null}
        {allowCurrentLocation && !loading ? (
          <button
            type="button"
            title="Use current location"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="shrink-0"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" style={{ color: PAPER.shadow }} />
            ) : (
              <LocateFixed className="size-4" style={{ color: PAPER.shadow }} />
            )}
          </button>
        ) : null}
        {query && !loading ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              onSelect(null);
            }}
          >
            <X className="size-3.5 shrink-0" style={{ color: PAPER.shadow }} />
          </button>
        ) : null}
      </div>

      {locateError ? (
        <p className="mt-1 text-[11px] font-medium" style={{ color: "#C0392B" }}>
          {locateError}
        </p>
      ) : null}

      {open && results.length > 0 ? (
        <div
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border-2 shadow-[3px_3px_0_0_rgba(61,52,41,0.25)]"
          style={{ borderColor: PAPER.ink, backgroundColor: PAPER.edge }}
        >
          {results.map((point, index) => (
            <button
              key={`${point.latitude}-${point.longitude}-${index}`}
              type="button"
              className="block w-full truncate px-3 py-2 text-left text-xs hover:bg-black/5"
              style={{ color: PAPER.ink }}
              onClick={() => {
                onSelect(point);
                setQuery(point.label);
                setOpen(false);
              }}
            >
              {point.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RoutePanel({ className }: { className?: string }) {
  const { origin, destination, mode, route, status, error, setOrigin, setDestination, setMode, computeRoute } =
    useRouteStore();

  const isSafe = route ? route.riskScore === 0 : null;

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border-2 p-4 shadow-[4px_4px_0_0_rgba(61,52,41,0.25)]",
        className,
      )}
      style={{ backgroundColor: PAPER.edge, borderColor: PAPER.ink }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: PAPER.shadow }}>
          Plan a route
        </p>
        <h2 className="text-base font-bold" style={{ color: PAPER.ink }}>
          Malabon &amp; Caloocan
        </h2>
      </div>

      <LocationField placeholder="Starting point" value={origin} onSelect={setOrigin} allowCurrentLocation />
      <LocationField placeholder="Destination" value={destination} onSelect={setDestination} />

      <div className="flex gap-2">
        {TRAVEL_MODE_OPTIONS.map(({ mode: option, label }) => {
          const Icon = MODE_ICON[option];
          const active = mode === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl border-2 py-2 text-[11px] font-medium transition-transform active:translate-y-px"
              style={{
                borderColor: PAPER.ink,
                backgroundColor: active ? PAPER.ink : "transparent",
                color: active ? PAPER.edge : PAPER.ink,
              }}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        className="border-2 shadow-[3px_3px_0_0_rgba(61,52,41,0.2)]"
        style={{ borderColor: PAPER.ink, backgroundColor: "#B8D4A0", color: PAPER.ink }}
        disabled={!origin || !destination || status === "loading"}
        onClick={() => computeRoute()}
      >
        {status === "loading" ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : null}
        Find the safest route
      </Button>

      {error ? (
        <p className="text-xs font-medium" style={{ color: "#C0392B" }}>
          {error}
        </p>
      ) : null}

      {route ? (
        <div
          className="flex flex-col gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm"
          style={{ borderColor: PAPER.ink, backgroundColor: PAPER.canvas, color: PAPER.ink }}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {isSafe ? (
              <ShieldCheck className="size-4" style={{ color: "#2E7D5C" }} />
            ) : (
              <ShieldAlert className="size-4" style={{ color: "#D97757" }} />
            )}
            {isSafe ? "Clear of known flood zones" : "Passes through some flood-prone areas"}
          </div>
          <p style={{ color: PAPER.shadow }}>
            {formatDistance(route.distanceMeters)} · about {formatDuration(route.durationSeconds)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
