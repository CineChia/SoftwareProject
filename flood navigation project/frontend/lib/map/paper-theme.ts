import type { FloodSeverity } from "./types";

export type { FloodSeverity };

/** Core paper-cutout palette used across every map UI element */
export const PAPER = {
  canvas: "#F4EFE4", // page/background paper
  ink: "#3D3429", // borders + primary text
  edge: "#FFFCF5", // card/panel surface (the "cut paper" edge)
  shadow: "#8A7A63", // secondary text
};

/**
 * Flood fill colors — kept translucent on purpose (like the NOAH
 * "Know Your Hazards" reference) so streets, buildings and labels stay
 * visible THROUGH the hazard tint instead of being blocked by it.
 */
export const FLOOD_COLORS: Record<
  FloodSeverity,
  { fill: [number, number, number, number]; shadow: [number, number, number, number]; height: number }
> = {
  low: { fill: [184, 212, 160, 80], shadow: [120, 140, 100, 160], height: 40 },
  medium: { fill: [255, 209, 102, 105], shadow: [180, 140, 60, 160], height: 90 },
  high: { fill: [255, 107, 107, 130], shadow: [170, 60, 60, 160], height: 150 },
};

/** Starting camera position, centered over the Malabon/Caloocan flood corridor */
export const INITIAL_VIEW = {
  longitude: 120.965,
  latitude: 14.665,
  zoom: 13.6,
  pitch: 45,
  bearing: -22,
};

/**
 * Positron has almost no street names or road casings at city zoom levels
 * — it's built to be a blank canvas for data layers, which is why streets
 * felt "missing." Voyager is the same free CARTO basemap family but keeps
 * road colors, street labels and POI labels visible, closer to the NOAH
 * reference (and to Waze/Grab-style navigation maps).
 */
export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

/**
 * Bounding box for the Malabon + SOUTH Caloocan urban core (the
 * contiguous built-up area the two cities actually share a border in).
 * Deliberately excludes North Caloocan (Camarin/Tala/Bagumbong), which is
 * a separate, non-adjacent lobe of Caloocan split off by Quezon City —
 * that's what was producing the stray flood cluster up near "Fortune
 * Village" in earlier screenshots. Used to (a) bias/restrict place search
 * so "Rizal Ave" resolves to the one here, not one elsewhere in the
 * Philippines, and (b) keep the flood layer confined to this area.
 */
export const REGION_BOUNDS = {
  west: 120.935,
  south: 14.63,
  east: 121.0,
  north: 14.71,
};
