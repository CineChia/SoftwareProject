"use client";

import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { PathLayer, PolygonLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { Feature, Polygon } from "geojson";
import { useCallback, useEffect, useMemo, useState } from "react";
import Map, { useControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { MapOverlay } from "@/components/map/MapOverlay";
import { RoutePanel } from "@/components/map/RoutePanel";
import { landmarks } from "@/lib/map/landmarks";
import { FLOOD_COLORS, INITIAL_VIEW, MAP_STYLE, PAPER, type FloodSeverity } from "@/lib/map/paper-theme";
import { sampleFloodZones, type FloodZoneProperties } from "@/lib/map/sample-flood-zones";
import { ROUTE_COLORS } from "@/lib/map/types";
import { useRouteStore } from "@/lib/store/useRouteStore";

type FloodFeature = Feature<Polygon, FloodZoneProperties>;

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

const SEVERITY_ORDER: FloodSeverity[] = ["low", "medium", "high"];

/**
 * Picks evenly-spaced points along a route and the compass-style bearing
 * at each one, so we can draw small direction chevrons along the line —
 * the same "which way am I actually going" cue Waze/Grab draw on the
 * live-navigation polyline.
 */
function buildRouteArrows(coordinates: [number, number][]) {
  if (coordinates.length < 3) return [];
  const step = Math.max(1, Math.floor(coordinates.length / 10));
  const arrows: { position: [number, number]; angle: number }[] = [];

  for (let i = step; i < coordinates.length - 1; i += step) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[Math.min(i + 1, coordinates.length - 1)];
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    if (dx === 0 && dy === 0) continue;
    // Compass bearing: 0° = north, clockwise positive.
    const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    // deck.gl's TextLayer measures its angle counter-clockwise from the
    // horizontal (east), so convert. If arrows ever render pointing the
    // wrong way on your deck.gl version, flip this to `bearing - 90`.
    arrows.push({ position: coordinates[i], angle: 90 - bearing });
  }
  return arrows;
}

export default function PaperCutoutMap() {
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; name: string; severity: FloodSeverity } | null>(
    null,
  );

  // Route state lives outside this component (see lib/store/useRouteStore)
  // so the RoutePanel and this map always stay in sync.
  const { origin, destination, mode, route } = useRouteStore();

  const floodLayers = useMemo(() => {
    // Precise, geography-anchored fills — real vector polygons scale
    // exactly with the map at every zoom level, instead of a HeatmapLayer's
    // screen-space blobs that visibly resize/reshape as you zoom.
    // Painted low → medium → high so the smaller, more severe core sits
    // on top of its wider halo (the graduated-hazard look).
    const fillLayers = SEVERITY_ORDER.map(
      (severity) =>
        new SolidPolygonLayer<FloodFeature>({
          id: `flood-fill-${severity}`,
          data: sampleFloodZones.features.filter((f) => f.properties!.severity === severity),
          getPolygon: (feature) => feature.geometry.coordinates,
          getFillColor: FLOOD_COLORS[severity].fill,
          extruded: false,
          pickable: false,
          parameters: { depthTest: false },
        }),
    );

    // A soft edge just on the high-severity cores, for a bit of definition
    // without outlining every nested ring (which read as clutter).
    const highEdge = new PathLayer<FloodFeature>({
      id: "flood-edges-high",
      data: sampleFloodZones.features.filter((f) => f.properties!.severity === "high"),
      getPath: (feature) => feature.geometry.coordinates[0] as [number, number][],
      getColor: [170, 60, 60, 130],
      getWidth: 1.5,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      parameters: { depthTest: false },
    });

    // Invisible — exists only so hovering still shows the zone name/severity.
    // Uses the same low→medium→high draw order as the fills above, so
    // hovering the small "high" core correctly reports "high" instead of
    // the wider "low"/"medium" ring it's nested inside.
    const hoverHitArea = new PolygonLayer<FloodFeature>({
      id: "flood-hover-hit-area",
      data: sampleFloodZones.features,
      pickable: true,
      getPolygon: (feature) => feature.geometry.coordinates,
      getFillColor: [0, 0, 0, 0],
      parameters: { depthTest: false },
      onHover: (info: PickingInfo<FloodFeature>) => {
        if (info.object?.properties) {
          setHoverInfo({
            x: info.x,
            y: info.y,
            name: info.object.properties.name,
            severity: info.object.properties.severity,
          });
          return;
        }
        setHoverInfo(null);
      },
    });

    return [...fillLayers, highEdge, hoverHitArea];
  }, []);

  // Static reference points (city halls, schools, the river) that give the
  // map real-world bearings, the way Waze/Google Maps always keep a few
  // landmark labels on screen even mid-navigation.
  const landmarkLayers = useMemo(
    () => [
      new ScatterplotLayer({
        id: "landmarks-dot",
        data: landmarks,
        getPosition: (d: (typeof landmarks)[number]) => [d.longitude, d.latitude],
        getFillColor: [61, 52, 41, 220],
        getLineColor: [255, 252, 245, 255],
        lineWidthUnits: "pixels",
        getLineWidth: 1.5,
        stroked: true,
        radiusUnits: "pixels",
        getRadius: 4,
        pickable: false,
        parameters: { depthTest: false },
      }),
      new TextLayer({
        id: "landmarks-label",
        data: landmarks,
        getPosition: (d: (typeof landmarks)[number]) => [d.longitude, d.latitude],
        getText: (d: (typeof landmarks)[number]) => d.name,
        getSize: 13,
        getColor: [61, 52, 41, 255],
        getPixelOffset: [0, -16],
        // A solid background pill reads far better than a thin text
        // outline once it's sitting on top of a busy street basemap +
        // the hazard tint — that combination is what was making labels
        // look "blurry" before.
        background: true,
        getBackgroundColor: [255, 252, 245, 235],
        backgroundPadding: [4, 2],
        fontFamily: "system-ui, sans-serif",
        fontSettings: { sdf: true },
        billboard: true,
        pickable: false,
        parameters: { depthTest: false },
      }),
    ],
    [],
  );

  // Route + marker layers, separated from the static layers above so they
  // can update on their own whenever the store changes.
  const routeLayers = useMemo(() => {
    const layers = [];

    if (route) {
      const arrows = buildRouteArrows(route.coordinates);
      layers.push(
        // Outer glow — the light "halo" that makes a colored line pop
        // against a busy basemap, same trick Waze/Grab use.
        new PathLayer({
          id: "route-glow",
          data: [route],
          getPath: (d: typeof route) => d.coordinates,
          getColor: [255, 252, 245, 150],
          getWidth: 14,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          parameters: { depthTest: false },
        }),
        // Dark casing so the bright line stays crisp on light roads too.
        new PathLayer({
          id: "route-casing",
          data: [route],
          getPath: (d: typeof route) => d.coordinates,
          getColor: [61, 52, 41, 230],
          getWidth: 9,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          parameters: { depthTest: false },
        }),
        // The actual route color, on top.
        new PathLayer({
          id: "route-line",
          data: [route],
          getPath: (d: typeof route) => d.coordinates,
          getColor: ROUTE_COLORS[mode],
          getWidth: 5,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          parameters: { depthTest: false },
        }),
        // Direction chevrons along the line — solid fill + a thin dark
        // outline (chevrons are small and single-glyph, so the outline
        // stays crisp here; it's multi-word labels that need a background
        // pill instead).
        new TextLayer({
          id: "route-arrows",
          data: arrows,
          getPosition: (d: (typeof arrows)[number]) => d.position,
          getText: () => "▲",
          getAngle: (d: (typeof arrows)[number]) => d.angle,
          getSize: 15,
          getColor: [255, 252, 245, 255],
          outlineWidth: 3,
          outlineColor: [61, 52, 41, 255],
          fontFamily: "system-ui, sans-serif",
          fontSettings: { sdf: true },
          billboard: false,
          parameters: { depthTest: false },
        }),
      );
    }

    const markers = [
      origin ? { ...origin, kind: "origin" as const } : null,
      destination ? { ...destination, kind: "destination" as const } : null,
    ].filter(Boolean) as { longitude: number; latitude: number; kind: "origin" | "destination" }[];

    if (markers.length > 0) {
      layers.push(
        new ScatterplotLayer({
          id: "route-markers",
          data: markers,
          getPosition: (d: (typeof markers)[number]) => [d.longitude, d.latitude],
          getFillColor: (d: (typeof markers)[number]) => (d.kind === "origin" ? [46, 125, 92, 255] : [214, 60, 60, 255]),
          getLineColor: [255, 252, 245, 255],
          lineWidthUnits: "pixels",
          getLineWidth: 3,
          stroked: true,
          radiusUnits: "pixels",
          getRadius: 9,
          pickable: false,
          parameters: { depthTest: false },
        }),
        new TextLayer({
          id: "route-marker-labels",
          data: markers,
          getPosition: (d: (typeof markers)[number]) => [d.longitude, d.latitude],
          getText: (d: (typeof markers)[number]) => (d.kind === "origin" ? "A" : "B"),
          getSize: 11,
          getColor: [255, 252, 245, 255],
          fontFamily: "system-ui, sans-serif",
          fontSettings: { sdf: true },
          billboard: true,
          pickable: false,
          parameters: { depthTest: false },
        }),
      );
    }

    return layers;
  }, [route, origin, destination, mode]);

  const layers = useMemo(
    () => [...floodLayers, ...landmarkLayers, ...routeLayers],
    [floodLayers, landmarkLayers, routeLayers],
  );

  // When a new route comes in, fly the camera to frame it.
  useEffect(() => {
    if (!mapRef || !route || route.coordinates.length === 0) return;

    const lngs = route.coordinates.map((c) => c[0]);
    const lats = route.coordinates.map((c) => c[1]);
    mapRef.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 96, duration: 1200, pitch: 52, bearing: -22 },
    );
  }, [mapRef, route]);

  const handleLocate = useCallback(() => {
    if (!mapRef || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 14,
          pitch: 52,
          bearing: -22,
          duration: 1800,
        });
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [mapRef]);

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: PAPER.canvas }}>
      <Map
        ref={setMapRef}
        initialViewState={INITIAL_VIEW}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        dragRotate
        maxPitch={60}
        minPitch={30}
      >
        <DeckOverlay layers={layers} />
      </Map>

      {/*
        Paper-texture "grain" — kept, but as a thin vignette hugging the
        edges only (not a wash across the whole viewport). It was
        previously covering the entire map, including every deck.gl label
        and the flood tint, which is what was reading as "blurry" — a
        semi-opaque layer sitting on top of the text, not an actual
        rendering issue with the text itself.
      */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at center, transparent 55%, rgba(61,52,41,0.5) 100%)",
        }}
      />

      <MapOverlay onLocate={handleLocate} />

      {/* Route planning panel — sits below the header, left side */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-start p-4 pt-24 sm:p-6 sm:pt-28">
        <RoutePanel />
      </div>

      {hoverInfo ? (
        <div
          className="pointer-events-none absolute z-20 rounded-xl border-2 px-3 py-2 text-sm shadow-[3px_3px_0_0_rgba(61,52,41,0.25)]"
          style={{
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            backgroundColor: PAPER.edge,
            borderColor: PAPER.ink,
            color: PAPER.ink,
          }}
        >
          <p className="font-semibold">{hoverInfo.name}</p>
          <p className="capitalize" style={{ color: PAPER.shadow }}>
            {hoverInfo.severity} flood risk
          </p>
        </div>
      ) : null}
    </div>
  );
}
