/**
 * Shared types for the routing feature.
 *
 * Keeping these in one small file means every future feature (saved trips,
 * evacuation centers, multi-stop routes, live alerts...) can import the same
 * vocabulary instead of re-inventing it. When you add a feature, extend
 * these types first — the rest of the app follows.
 */

export type TravelMode = "walk" | "bike" | "car";

export interface RoutePoint {
  /** Human-readable label shown in the input + suggestion list */
  label: string;
  longitude: number;
  latitude: number;
}

export type FloodSeverity = "low" | "medium" | "high";

export interface RouteSummary {
  mode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  /** 0 = never touches a known flood zone. Higher = riskier. */
  riskScore: number;
  /** Route geometry as [lng, lat] pairs, ready for a deck.gl PathLayer */
  coordinates: [number, number][];
  /** Which flood zones (and how much) this route passes through */
  floodExposure: { severity: FloodSeverity; segments: number }[];
}

/** Average travel speed per mode, used to estimate ETA (meters/second) */
export const MODE_SPEED_MPS: Record<TravelMode, number> = {
  walk: 1.3, // ~4.7 km/h, comfortable walk/light run pace
  bike: 4.2, // ~15 km/h, urban cycling
  car: 8.3, // ~30 km/h, urban driving with traffic
};

/** Route line color per mode, in deck.gl's [r,g,b,a] format */
export const ROUTE_COLORS: Record<TravelMode, [number, number, number, number]> = {
  walk: [61, 52, 41, 255],
  bike: [46, 125, 140, 255],
  car: [214, 93, 60, 255],
};

export const TRAVEL_MODE_OPTIONS: { mode: TravelMode; label: string }[] = [
  { mode: "walk", label: "Walk / Run" },
  { mode: "bike", label: "Bicycle" },
  { mode: "car", label: "Car" },
];
