import { Layers, MapPin, Navigation } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FLOOD_COLORS, PAPER, type FloodSeverity } from "@/lib/map/paper-theme";
import { cn } from "@/lib/utils";

const LEGEND: { severity: FloodSeverity; label: string }[] = [
  { severity: "low", label: "Low" },
  { severity: "medium", label: "Medium" },
  { severity: "high", label: "High" },
];

type MapOverlayProps = {
  onLocate?: () => void;
  className?: string;
};

function rgbToCss([r, g, b]: [number, number, number]) {
  return `rgb(${r} ${g} ${b})`;
}

export function MapOverlay({ onLocate, className }: MapOverlayProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10 flex flex-col p-4 sm:p-6", className)}>
      <header className="pointer-events-auto flex items-start justify-between gap-4">
        <div
          className="rounded-2xl border-2 px-4 py-3 shadow-[4px_4px_0_0_rgba(61,52,41,0.25)]"
          style={{
            backgroundColor: PAPER.edge,
            borderColor: PAPER.ink,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: PAPER.shadow }}>
            Flood Navigation
          </p>
          <h1 className="text-lg font-bold sm:text-xl" style={{ color: PAPER.ink }}>
            Paper Cutout Map
          </h1>
          <p className="mt-1 max-w-xs text-sm" style={{ color: PAPER.shadow }}>
            Stacked hazard layers over Metro Manila — drag to explore.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-events-auto border-2 shadow-[3px_3px_0_0_rgba(61,52,41,0.2)]"
          style={{ borderColor: PAPER.ink, backgroundColor: PAPER.edge }}
          onClick={onLocate}
        >
          <Navigation data-icon="inline-start" />
          My location
        </Button>
      </header>

      <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div
          className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-medium shadow-[3px_3px_0_0_rgba(61,52,41,0.15)]"
          style={{ backgroundColor: PAPER.edge, borderColor: PAPER.ink, color: PAPER.shadow }}
        >
          <Layers className="size-3.5" />
          Isometric paper layers
        </div>

        <div
          className="pointer-events-auto rounded-2xl border-2 px-4 py-3 shadow-[4px_4px_0_0_rgba(61,52,41,0.25)]"
          style={{ backgroundColor: PAPER.edge, borderColor: PAPER.ink }}
        >
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: PAPER.ink }}>
            <MapPin className="size-3.5" />
            Flood depth
          </p>
          <div className="flex flex-wrap gap-3">
            {LEGEND.map(({ severity, label }) => (
              <div key={severity} className="flex items-center gap-2 text-sm" style={{ color: PAPER.ink }}>
                <span
                  className="inline-block size-4 rounded-sm border-2 shadow-[2px_2px_0_0_rgba(61,52,41,0.3)]"
                  style={{
                    backgroundColor: rgbToCss(FLOOD_COLORS[severity].fill.slice(0, 3) as [number, number, number]),
                    borderColor: PAPER.ink,
                  }}
                />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
