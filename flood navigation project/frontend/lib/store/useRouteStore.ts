"use client";

import { create } from "zustand";

import { findSafestRoute } from "@/lib/map/routing";
import type { RoutePoint, RouteSummary, TravelMode } from "@/lib/map/types";

interface RouteState {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  mode: TravelMode;
  route: RouteSummary | null;
  status: "idle" | "loading" | "error";
  error: string | null;

  setOrigin: (point: RoutePoint | null) => void;
  setDestination: (point: RoutePoint | null) => void;
  setMode: (mode: TravelMode) => void;
  computeRoute: () => Promise<void>;
  reset: () => void;
}

/**
 * Single source of truth for the routing feature. RoutePanel writes to it,
 * PaperCutoutMap reads from it to draw the route + markers, and MapOverlay
 * (or any future component — an ETA widget, a share button, a saved-trips
 * list) can plug in the same way without new prop-drilling.
 */
export const useRouteStore = create<RouteState>((set, get) => ({
  origin: null,
  destination: null,
  mode: "walk",
  route: null,
  status: "idle",
  error: null,

  setOrigin: (point) => set({ origin: point, route: null, error: null }),
  setDestination: (point) => set({ destination: point, route: null, error: null }),
  setMode: (mode) => set({ mode, route: null, error: null }),

  computeRoute: async () => {
    const { origin, destination, mode } = get();
    if (!origin || !destination) {
      set({ status: "error", error: "Set both a starting point and a destination first." });
      return;
    }
    set({ status: "loading", error: null });
    try {
      const route = await findSafestRoute(origin, destination, mode);
      set({ route, status: "idle" });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Something went wrong." });
    }
  },

  reset: () => set({ origin: null, destination: null, route: null, status: "idle", error: null }),
}));
