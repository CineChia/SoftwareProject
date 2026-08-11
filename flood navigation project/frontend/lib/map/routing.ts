import { REGION_BOUNDS } from "./paper-theme";
import { sampleFloodZones, type FloodZoneProperties } from "./sample-flood-zones";
import { MODE_SPEED_MPS, type RoutePoint, type RouteSummary, type TravelMode } from "./types";

/**
 * This file is the ONLY place that talks to outside services. If you later
 * swap Nominatim/OSRM for Google Places + Directions, or a self-hosted OSRM
 * with real foot/bike profiles, you only ever touch this file — the store,
 * the panel, and the map layer don't need to change.
 */

// ---- 1. Search a place name → coordinates -------------------------------

export async function geocodePlace(query: string): Promise<RoutePoint[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "0",
    limit: "8",
    countrycodes: "ph",
    // viewbox WITHOUT `bounded: "1"` biases results toward Malabon/Caloocan
    // without hard-rejecting everything outside the box — `bounded` was
    // throwing away legitimate streets and landmarks that sat just past
    // the edge of REGION_BOUNDS, which is what made searching feel limited.
    viewbox: `${REGION_BOUNDS.west},${REGION_BOUNDS.north},${REGION_BOUNDS.east},${REGION_BOUNDS.south}`,
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Couldn't search for that place. Try again.");

  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((item) => ({
    label: item.display_name,
    longitude: parseFloat(item.lon),
    latitude: parseFloat(item.lat),
  }));
}

// ---- 1b. "Use my current location" ---------------------------------------

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser doesn't support location access."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error("Couldn't get your location — check location permissions.")),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

/** Turns raw GPS coordinates into a readable label, e.g. for the search box */
export async function reverseGeocode(latitude: number, longitude: number): Promise<RoutePoint> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: "jsonv2" });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Couldn't identify your current location.");
  const data = await res.json();
  return { label: data.display_name ?? "Current location", longitude, latitude };
}

// ---- 2. Score how "flooded" a route is -----------------------------------

const SEVERITY_WEIGHT: Record<FloodZoneProperties["severity"], number> = {
  low: 1,
  medium: 4,
  high: 10,
};

const SEVERITY_RANK: Record<FloodZoneProperties["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** Simple ray-casting point-in-polygon test (no extra dependency needed) */
function pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function scoreRouteRisk(coordinates: [number, number][]) {
  const exposure: Record<FloodZoneProperties["severity"], number> = { low: 0, medium: 0, high: 0 };
  let riskScore = 0;

  for (const coord of coordinates) {
    // Flood zones are now nested rings (a point inside the "high" core is
    // ALSO inside its surrounding "medium" and "low" rings), so check
    // every zone for this point and keep the worst match — don't stop at
    // the first hit, or a point standing in the most dangerous part of a
    // zone would get counted as merely "low" risk.
    let worst: FloodZoneProperties["severity"] | null = null;
    for (const feature of sampleFloodZones.features) {
      const ring = feature.geometry.coordinates[0] as [number, number][];
      if (pointInPolygon(coord, ring)) {
        const severity = feature.properties!.severity;
        if (!worst || SEVERITY_RANK[severity] > SEVERITY_RANK[worst]) worst = severity;
      }
    }
    if (worst) {
      exposure[worst] += 1;
      riskScore += SEVERITY_WEIGHT[worst];
    }
  }

  return { riskScore, exposure };
}

// ---- 3. Find the safest route between two points -------------------------

const OSRM_DRIVING_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

/**
 * IMPORTANT LIMITATION: the free public OSRM demo server only serves the
 * "driving" profile — it doesn't have real walking/cycling street graphs.
 * We use its road geometry for every mode, then re-time it with realistic
 * walk/bike/car speeds so distance + ETA stay sensible. When you're ready
 * for production-accurate foot/bike routing, replace OSRM_DRIVING_ENDPOINT
 * with a self-hosted OSRM (which supports foot/bike profiles) or a paid
 * Directions API — the rest of this function stays the same.
 */
export async function findSafestRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: TravelMode,
): Promise<RouteSummary> {
  const coordsParam = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    alternatives: "true",
    overview: "full",
    geometries: "geojson",
    steps: "false",
  });

  const res = await fetch(`${OSRM_DRIVING_ENDPOINT}/${coordsParam}?${params.toString()}`);
  if (!res.ok) throw new Error("Couldn't calculate a route between those two points.");

  const data = await res.json();
  if (!data.routes?.length) throw new Error("No route was found between those points.");

  const speed = MODE_SPEED_MPS[mode];

  const candidates: RouteSummary[] = data.routes.map((route: any) => {
    const coordinates = route.geometry.coordinates as [number, number][];
    const { riskScore, exposure } = scoreRouteRisk(coordinates);
    const distanceMeters = route.distance as number;

    return {
      mode,
      distanceMeters,
      durationSeconds: distanceMeters / speed,
      riskScore,
      coordinates,
      floodExposure: (Object.entries(exposure) as [FloodZoneProperties["severity"], number][])
        .filter(([, segments]) => segments > 0)
        .map(([severity, segments]) => ({ severity, segments })),
    };
  });

  const shortest = [...candidates].sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  const safest = [...candidates].sort((a, b) => a.riskScore - b.riskScore)[0];

  // Prefer the safest option, but don't suggest a huge detour: if avoiding
  // flooding would make the trip more than 60% longer, fall back to the
  // shortest route so the suggestion still feels reasonable.
  const worthTheDetour = safest.riskScore === 0 || safest.distanceMeters <= shortest.distanceMeters * 1.6;
  return worthTheDetour ? safest : shortest;
}
