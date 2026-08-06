import { PreferencesForm } from "@/app/_components/preferences-form";
import { isEnvSet } from "@/app/_lib/format";
import { copy } from "@/src/copy";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { connectors } from "@/src/core/connectors";
import { deliveryChannels } from "@/src/core/delivery";
import { llmProviders } from "@/src/core/llm";

interface KeyRow {
  name: string;
  set: boolean;
  source: string;
}

function collectKeyRows(): KeyRow[] {
  const rows: KeyRow[] = [];
  const seen = new Set<string>();

  const push = (name: string, source: string): void => {
    if (seen.has(name)) {
      return;
    }
    seen.add(name);
    rows.push({ name, set: isEnvSet(name), source });
  };

  for (const connector of connectors) {
    for (const name of connector.requiredEnv) {
      push(name, connector.label);
    }
  }
  // Optional IMAP port — still useful to surface.
  push("IMAP_PORT", "IMAP Mailbox (optional)");

  for (const provider of llmProviders) {
    for (const name of provider.requiredEnv) {
      push(name, provider.label);
    }
  }
  push("OPENAI_BASE_URL", "OpenAI-compatible (optional)");

  for (const channel of deliveryChannels) {
    for (const name of channel.requiredEnv) {
      push(name, channel.label);
    }
  }

  push("ROOSTER_RUN_TOKEN", "HTTP /api/run trigger");

  return rows;
}

export default async function SettingsPage() {
  const rootDir = resolveRootDir();
  let timezone = "UTC";
  let scheduleHint = "0 7 * * *";
  let llmProvider = "stub";
  let llmModel = "stub";
  let deliveryChannel = "file";
  const enabled = new Set<string>(["demo"]);

  try {
    const loaded = await loadConfig({ rootDir });
    timezone = loaded.config.timezone;
    scheduleHint = loaded.config.scheduleHint ?? scheduleHint;
    llmProvider = loaded.config.llm.provider;
    llmModel = loaded.config.llm.model;
    deliveryChannel = loaded.config.delivery.channel;
    enabled.clear();
    for (const entry of loaded.config.connectors) {
      if (entry.enabled) {
        enabled.add(entry.id);
      }
    }
  } catch {
    // First-run: preferences form will create rooster.config.json on save.
  }

  const keyRows = collectKeyRows();

  return (
    <main className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {copy.settings.title}
      </h1>

      {/* Keys: read-only status board — no secret inputs on purpose. */}
      <section className="flex flex-col gap-3 rounded border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-foreground">
            {copy.settings.keysHeading}
          </h2>
          <p className="text-sm text-muted">{copy.settings.keysBlurb}</p>
          <p className="text-xs text-muted">{copy.settings.keysDocHint}</p>
        </div>
        <ul className="divide-y divide-border border-t border-border">
          {keyRows.map((row) => (
            <li
              key={row.name}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
            >
              <div className="flex flex-col gap-0.5">
                <span className="metric-mono text-foreground">{row.name}</span>
                <span className="text-xs text-muted">{row.source}</span>
              </div>
              <span
                className={
                  row.set
                    ? "metric-mono text-xs text-ok"
                    : "metric-mono text-xs text-accent"
                }
              >
                {row.set ? copy.settings.keysSet : copy.settings.keysMissing}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Preferences: editable, never secrets. */}
      <section className="flex flex-col gap-3 rounded border border-accent/25 bg-surface-raised p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-foreground">
            {copy.settings.preferencesHeading}
          </h2>
          <p className="text-sm text-muted">{copy.settings.preferencesBlurb}</p>
        </div>
        <PreferencesForm
          timezone={timezone}
          scheduleHint={scheduleHint}
          llmProvider={llmProvider}
          llmModel={llmModel}
          deliveryChannel={deliveryChannel}
          connectors={connectors.map((c) => ({
            id: c.id,
            label: c.label,
            enabled: enabled.has(c.id),
          }))}
          llmProviders={llmProviders.map((p) => ({
            id: p.id,
            label: p.label,
          }))}
          deliveryChannels={deliveryChannels.map((c) => ({
            id: c.id,
            label: c.label,
          }))}
        />
      </section>
    </main>
  );
}
