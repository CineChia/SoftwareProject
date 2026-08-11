import { PAPER } from "@/lib/map/paper-theme";

export default function Loading() {
  return (
    <div
      className="flex h-screen w-full flex-col items-center justify-center gap-4"
      style={{ backgroundColor: PAPER.canvas, color: PAPER.ink }}
    >
      <div className="flex items-end gap-2">
        <div
          className="h-8 w-14 rounded-md border-2 shadow-[3px_3px_0_0_rgba(61,52,41,0.25)]"
          style={{ backgroundColor: "#FFE066", borderColor: PAPER.ink }}
        />
        <div
          className="h-12 w-16 rounded-md border-2 shadow-[4px_4px_0_0_rgba(61,52,41,0.25)]"
          style={{ backgroundColor: "#FF9F43", borderColor: PAPER.ink }}
        />
        <div
          className="h-16 w-14 rounded-md border-2 shadow-[5px_5px_0_0_rgba(61,52,41,0.25)]"
          style={{ backgroundColor: "#FF6B6B", borderColor: PAPER.ink }}
        />
      </div>
      <p className="text-sm font-medium">Loading paper map layers…</p>
    </div>
  );
}
