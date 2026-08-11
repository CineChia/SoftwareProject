export type LandmarkKind = "hospital" | "school" | "government" | "waterway";

export interface Landmark {
  name: string;
  kind: LandmarkKind;
  longitude: number;
  latitude: number;
}

/**
 * A small, hand-picked set of real, verified landmarks in Malabon and
 * South Caloocan — enough to give the map bearings without needing a
 * full places database/API. Coordinates cross-checked against public
 * sources (OpenStreetMap / Wikipedia) as of this writing. Add more here
 * any time; PaperCutoutMap picks up new entries automatically.
 */
export const landmarks: Landmark[] = [
  { name: "Malabon City Hall", kind: "government", longitude: 120.9508, latitude: 14.6577 },
  { name: "University of the East – Caloocan", kind: "school", longitude: 120.9769, latitude: 14.659 },
  { name: "Bonifacio Monument (Monumento)", kind: "government", longitude: 120.9841, latitude: 14.6571 },
  { name: "Caloocan High School", kind: "school", longitude: 120.9821, latitude: 14.6516 },
  { name: "St. Mary's Academy of Caloocan", kind: "school", longitude: 120.993, latitude: 14.6549 },
  { name: "Tullahan River", kind: "waterway", longitude: 120.964, latitude: 14.678 },
];
