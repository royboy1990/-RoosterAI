import { copy } from "@/src/copy";

export function DemoBanner() {
  return (
    <div
      role="status"
      className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent"
    >
      <span className="metric-mono mr-2 font-semibold">{copy.demoMarker}</span>
      {copy.demoBanner}
    </div>
  );
}
