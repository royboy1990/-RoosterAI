import { SetupForm } from "@/app/_components/setup-form";
import { isEnvSet } from "@/app/_lib/format";
import { loadGa4PickerState } from "@/app/_lib/ga4";
import { loadGscPickerState } from "@/app/_lib/gsc";
import { copy } from "@/src/copy";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { connectors } from "@/src/core/connectors";
import { deliveryChannels } from "@/src/core/delivery";
import { llmProviders } from "@/src/core/llm";

interface KeyGroup {
  label: string;
  keys: Array<{ name: string; set: boolean }>;
}

function buildKeyGroups(env: NodeJS.ProcessEnv): KeyGroup[] {
  const groups: KeyGroup[] = [];

  for (const connector of connectors) {
    if (
      connector.requiredEnv.length === 0 &&
      (connector.optionalEnv?.length ?? 0) === 0
    ) {
      continue;
    }
    const keys = [
      ...connector.requiredEnv.map((name) => ({
        name,
        set: isEnvSet(name, env),
      })),
      ...(connector.optionalEnv ?? []).map((name) => ({
        name,
        set: isEnvSet(name, env),
      })),
    ];
    groups.push({
      label: connector.label,
      keys,
    });
  }

  for (const provider of llmProviders) {
    if (provider.requiredEnv.length === 0) {
      continue;
    }
    groups.push({
      label: provider.label,
      keys: provider.requiredEnv.map((name) => ({
        name,
        set: isEnvSet(name, env),
      })),
    });
  }

  for (const channel of deliveryChannels) {
    if (channel.requiredEnv.length === 0) {
      continue;
    }
    groups.push({
      label: channel.label,
      keys: channel.requiredEnv.map((name) => ({
        name,
        set: isEnvSet(name, env),
      })),
    });
  }

  return groups;
}

export default async function SetupPage() {
  const rootDir = resolveRootDir();
  const loaded = await loadConfig({ rootDir });
  const selectedConnectorIds = loaded.config.connectors.map((entry) => entry.id);
  const keyGroups = buildKeyGroups(loaded.env);
  const ga4 = await loadGa4PickerState(loaded, rootDir);
  const gsc = await loadGscPickerState(loaded, rootDir);

  return (
    <main className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.setup.title}
        </h1>
        <p className="text-sm text-muted">{copy.setup.blurb}</p>
      </div>

      <section className="flex flex-col gap-3 rounded border border-border bg-surface/80 p-4 backdrop-blur-md">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-foreground">
            {copy.setup.keysHeading}
          </h2>
          <p className="text-sm text-muted">{copy.setup.keysBlurb}</p>
        </div>
        <ul className="flex flex-col gap-4">
          {keyGroups.map((group) => (
            <li key={group.label} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">{group.label}</p>
              <ul className="divide-y divide-border border-t border-border">
                {group.keys.map((key) => (
                  <li
                    key={key.name}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <span className="metric-mono text-foreground">{key.name}</span>
                    <span
                      className={
                        key.set
                          ? "metric-mono text-xs text-ok"
                          : "metric-mono text-xs text-accent"
                      }
                    >
                      {key.set ? copy.setup.keysSet : copy.setup.keysMissing}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <SetupForm
        selectedConnectorIds={selectedConnectorIds}
        connectors={connectors
          .filter(
            (connector) =>
              !(connector.id === "ga4" && ga4.credentialsReady) &&
              !(connector.id === "gsc" && gsc.credentialsReady),
          )
          .map((connector) => ({
            id: connector.id,
            label: connector.label,
            description: connector.description,
          }))}
        llmProvider={loaded.config.llm.provider}
        llmModel={loaded.config.llm.model}
        deliveryChannel={loaded.config.delivery.channel}
        llmProviders={llmProviders.map((provider) => ({
          id: provider.id,
          label: provider.label,
          defaultModel: provider.defaultModel,
        }))}
        deliveryChannels={deliveryChannels.map((channel) => ({
          id: channel.id,
          label: channel.label,
        }))}
        ga4Picker={{
          credentialsReady: ga4.credentialsReady,
          initialProperties: ga4.properties,
          initialSelectedIds: ga4.selectedIds,
          initialError: ga4.error,
        }}
        gscPicker={{
          credentialsReady: gsc.credentialsReady,
          initialSites: gsc.sites,
          initialSelectedUrls: gsc.selectedUrls,
          initialError: gsc.error,
        }}
      />
    </main>
  );
}
