import { sampleFloodZones, type FloodZoneProperties } from "./sample-flood-zones";

const SEVERITY_WEIGHT: Record<FloodZoneProperties["severity"], number> = {
  low: 1,
  medium: 3,
  high: 6,
};

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

export interface FloodHeatPoint {
  position: [number, number];
  weight: number;
}

/**
 * Turns each flood polygon into a small cluster of weighted points.
 * HeatmapLayer blends these into a soft, semi-transparent "thermal" glow —
 * so roads and labels stay visible underneath, unlike a solid extruded shape.
 *
 * Swap this for real point-density data later (e.g. individual sensor
 * readings or crowd reports) — HeatmapLayer only needs { position, weight }.
 */
export const floodHeatPoints: FloodHeatPoint[] = sampleFloodZones.features.flatMap((feature) => {
  const ring = feature.geometry.coordinates[0] as [number, number][];
  const weight = SEVERITY_WEIGHT[feature.properties!.severity];

  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const GRID = 4;
  const points: FloodHeatPoint[] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const lng = minLng + ((i + 0.5) / GRID) * (maxLng - minLng);
      const lat = minLat + ((j + 0.5) / GRID) * (maxLat - minLat);
      if (pointInPolygon([lng, lat], ring)) {
        points.push({ position: [lng, lat], weight });
      }
    }
  }

  // Guarantee at least one point so small zones still show up on the heatmap
  if (points.length === 0) {
    points.push({ position: [(minLng + maxLng) / 2, (minLat + maxLat) / 2], weight });
  }

  return points;
});
