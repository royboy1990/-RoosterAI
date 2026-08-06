import { CoopBoard, type CoopCardView } from "@/app/_components/coop-board";
import { copy } from "@/src/copy";
import {
  hasRoosterConfig,
  loadConfig,
  resolveRootDir,
} from "@/src/core/config";
import { connectors } from "@/src/core/connectors";
import {
  resolveConnectors,
  resolveUnknownInstalled,
  type ProviderCard,
} from "@/src/core/registry";
import type { Connector } from "@/src/core/types";

function toView(card: ProviderCard<Connector>): CoopCardView {
  return {
    id: card.provider.id,
    label: card.provider.label,
    description: card.provider.description,
    tags: card.provider.tags,
    setupDocs: card.provider.setupDocs,
    requiredEnv: card.provider.requiredEnv,
    optionalEnv: card.provider.optionalEnv,
    state: card.state,
    missingEnv: card.missingEnv,
  };
}

export default async function CoopPage() {
  const rootDir = resolveRootDir();
  const firstRun = !hasRoosterConfig(rootDir);
  let installed: CoopCardView[] = [];
  let available: CoopCardView[] = [];

  if (firstRun) {
    // No config yet — entire catalog is available; install creates the file.
    available = connectors.map((provider) => ({
      id: provider.id,
      label: provider.label,
      description: provider.description,
      tags: provider.tags,
      setupDocs: provider.setupDocs,
      requiredEnv: provider.requiredEnv,
      optionalEnv: provider.optionalEnv,
      state: "available" as const,
      missingEnv: [...provider.requiredEnv],
    }));
  } else {
    const loaded = await loadConfig({ rootDir });
    const cards = resolveConnectors(loaded);
    installed = cards
      .filter((card) => card.state !== "available")
      .map(toView);

    for (const unknown of resolveUnknownInstalled(loaded)) {
      installed.push({
        id: unknown.id,
        label: unknown.id,
        description: copy.coop.unknownBlurb,
        tags: [],
        setupDocs: "docs/CUSTOM-CONNECTORS.md",
        requiredEnv: [],
        state: unknown.state === "muted" ? "muted" : "unknown",
        missingEnv: [],
        unknown: true,
      });
    }

    available = cards
      .filter((card) => card.state === "available")
      .map(toView);
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstRun ? copy.coop.firstRunHeading : copy.coop.title}
        </h1>
        <p className="text-sm text-muted">
          {firstRun ? copy.coop.firstRunBlurb : copy.coop.blurb}
        </p>
      </div>
      <CoopBoard
        installed={installed}
        available={available}
        firstRun={firstRun}
      />
    </main>
  );
}
