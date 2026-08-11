import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { FloodSeverity } from "./types";

export interface FloodZoneProperties {
  name: string;
  severity: FloodSeverity;
}

/**
 * Deterministic pseudo-random generator (mulberry32) — intentionally NOT
 * Math.random(). This file is a Next.js module, evaluated once on the
 * server (for the initial HTML) and again on the client (for hydration).
 * Math.random() would produce different blob shapes each time and break
 * hydration; a seeded PRNG always returns the same sequence for the same
 * seed, so server and client always agree.
 */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds an irregular, hand-drawn-looking "flood puddle" polygon instead
 * of a neat square — closer to how real hazard maps trace low-lying
 * terrain and waterways (see the reference DOH-style map).
 */
function blob(
  name: string,
  severity: FloodSeverity,
  [cx, cy]: [number, number],
  radiusDeg: number,
  seed: number,
  vertexCount = 14,
): Feature<Polygon, FloodZoneProperties> {
  const rand = mulberry32(seed);
  const coords: [number, number][] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const wobble = 0.55 + rand() * 0.65; // varies the radius per-vertex
    const angleJitter = (rand() - 0.5) * (Math.PI / vertexCount);
    const r = radiusDeg * wobble;
    const lng = cx + Math.cos(angle + angleJitter) * r * 1.15; // slightly wider east–west
    const lat = cy + Math.sin(angle + angleJitter) * r;
    coords.push([lng, lat]);
  }
  coords.push(coords[0]);
  return { type: "Feature", properties: { name, severity }, geometry: { type: "Polygon", coordinates: [coords] } };
}

/**
 * One flood-prone cluster = three NESTED rings (low outer → medium →
 * high core), ordered low-to-high in the returned array. That ordering
 * matters twice downstream:
 *  - PaperCutoutMap paints fill layers in this same order, so the small
 *    high-severity core renders on top of the wider low/medium halo —
 *    giving the soft graduated-hazard look instead of one flat block.
 *  - The hover hit-layer picks whatever's drawn last at a pixel, so
 *    hovering the core correctly reports "high", not the outer "low"
 *    ring it's nested inside.
 */
function cluster(name: string, center: [number, number], coreRadiusDeg: number, seedBase: number) {
  return [
    blob(name, "low", center, coreRadiusDeg * 2.3, seedBase + 1, 16),
    blob(name, "medium", center, coreRadiusDeg * 1.5, seedBase + 2, 14),
    blob(name, "high", center, coreRadiusDeg, seedBase + 3, 12),
  ];
}

/**
 * PLACEHOLDER DATA — hand-placed to roughly trace the Tullahan River /
 * Dagat-Dagatan waterway corridor through Malabon and South Caloocan,
 * the same stretch the reference DOH hazard map covers, and kept inside
 * REGION_BOUNDS in paper-theme.ts. Swap this file's contents for a real
 * hazard dataset (MMDA/LGU shapefiles, DOST-Project NOAH, etc.) converted
 * to GeoJSON when you have one — as long as every Feature keeps a
 * `severity: "low" | "medium" | "high"` property, nothing else (theming,
 * risk scoring, legend, hover) needs to change.
 */
export const sampleFloodZones: FeatureCollection<Polygon, FloodZoneProperties> = {
  type: "FeatureCollection",
  features: [
    ...cluster("Dagat-Dagatan (Malabon)", [120.961, 14.6685], 0.0026, 10),
    ...cluster("Longos / Tonsuya (Malabon)", [120.953, 14.66], 0.0022, 20),
    ...cluster("Potrero (Malabon)", [120.968, 14.6805], 0.0022, 30),
    ...cluster("Tinajeros (Malabon)", [120.957, 14.6735], 0.002, 40),
    ...cluster("Maypajo (Caloocan)", [120.9695, 14.6555], 0.0026, 50),
    ...cluster("Bagong Barrio (Caloocan)", [120.977, 14.652], 0.0018, 60),
    ...cluster("Grace Park (Caloocan)", [120.984, 14.648], 0.002, 70),
    ...cluster("Sangandaan (Caloocan)", [120.985, 14.665], 0.0018, 80),
  ],
};
