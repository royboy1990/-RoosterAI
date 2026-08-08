import { FoldableKeyGroup } from "@/app/_components/foldable-key-group";
import { Ga4PropertyPicker } from "@/app/_components/ga4-property-picker";
import { GscSitePicker } from "@/app/_components/gsc-site-picker";
import { SiteHealthOriginsEditor } from "@/app/_components/site-health-origins-editor";
import { AudioPreferences } from "@/app/_components/audio-preferences";
import { EstimatedSpendSection } from "@/app/_components/estimated-spend-section";
import { PreferencesForm } from "@/app/_components/preferences-form";
import {
  SettingsKeysIcon,
  SettingsPreferencesIcon,
} from "@/app/_components/settings-section-icons";
import { SettingsSectionFold } from "@/app/_components/settings-section-fold";
import { SourceLogo } from "@/app/_components/source-logo";
import { isEnvSet } from "@/app/_lib/format";
import { loadGa4PickerState } from "@/app/_lib/ga4";
import { loadGscPickerState } from "@/app/_lib/gsc";
import { copy } from "@/src/copy";
import { loadConfig, resolveRootDir } from "@/src/core/config";
import { deliveryChannels } from "@/src/core/delivery";
import { labelForImapHost } from "@/src/core/imap-providers";
import { llmProviders } from "@/src/core/llm";
import { summarizeBriefSpend } from "@/src/core/pricing/rollup";
import { resolveConnectors } from "@/src/core/registry";
import type { SiteHealthSite } from "@/src/core/connectors/site-health-shared";

type KeyGroupStatus = "ready" | "needsKeys" | "stub" | "unused";

interface KeyRow {
  name: string;
  set: boolean;
  optional: boolean;
  sourceId: string;
  /** True when this key belongs to the currently selected LLM / delivery. */
  inUse: boolean;
}

interface KeyGroup {
  id: string;
  label: string;
  blurb?: string;
  /** Logo for the group header; rows keep their own sourceId logos. */
  sourceId: string;
  status: KeyGroupStatus;
  /** Extra status detail, e.g. active LLM label. */
  statusDetail?: string;
  rows: KeyRow[];
}

function groupStatusLabel(status: KeyGroupStatus): string {
  switch (status) {
    case "ready":
      return copy.settings.keysGroupReady;
    case "needsKeys":
      return copy.settings.keysGroupNeedsKeys;
    case "stub":
      return copy.settings.keysGroupStub;
    case "unused":
      return copy.settings.keysGroupUnused;
  }
}

function groupStatusClass(status: KeyGroupStatus): string {
  switch (status) {
    case "ready":
      return "metric-mono text-xs text-ok";
    case "needsKeys":
      return "metric-mono text-xs text-accent";
    case "stub":
    case "unused":
      return "metric-mono text-xs text-muted";
  }
}

function allRequiredSet(
  names: readonly string[],
  env: NodeJS.ProcessEnv,
): boolean {
  return names.every((name) => isEnvSet(name, env));
}

function collectKeyGroups(
  loaded: Awaited<ReturnType<typeof loadConfig>>,
): KeyGroup[] {
  const groups: KeyGroup[] = [];
  const env = loaded.env;
  const activeLlmId = loaded.config.llm.provider;
  const activeDeliveryId = loaded.config.delivery.channel;

  // Installed connectors only — available catalog items never hit the Keys board.
  // Defaults source counts as installed for the keys board (auto-detected intent).
  for (const card of resolveConnectors(loaded)) {
    if (card.state === "available") {
      continue;
    }
    const required = card.provider.requiredEnv;
    const optional = card.provider.optionalEnv ?? [];
    if (required.length === 0 && optional.length === 0) {
      continue;
    }

    const rows: KeyRow[] = [
      ...required.map((name) => ({
        name,
        set: isEnvSet(name, env),
        optional: false,
        sourceId: card.provider.id,
        inUse: false,
      })),
      ...optional.map((name) => ({
        name,
        set: isEnvSet(name, env),
        optional: true,
        sourceId: card.provider.id,
        inUse: false,
      })),
    ];

    const isImap = card.provider.id === "imap";
    groups.push({
      id: `connector:${card.provider.id}`,
      label: isImap
        ? labelForImapHost(env.IMAP_HOST)
        : card.provider.label,
      sourceId: card.provider.id,
      status: allRequiredSet(required, env) ? "ready" : "needsKeys",
      rows,
    });
  }

  // LLM: alternatives — any one real provider is enough to summarize.
  const llmRows: KeyRow[] = [];
  let anyLlmReady = false;
  let readyLlmLabel: string | undefined;

  for (const provider of llmProviders) {
    if (provider.requiredEnv.length === 0) {
      continue;
    }
    const providerReady = allRequiredSet(provider.requiredEnv, env);
    if (providerReady) {
      anyLlmReady = true;
      if (!readyLlmLabel || provider.id === activeLlmId) {
        readyLlmLabel = provider.label;
      }
    }
    for (const name of provider.requiredEnv) {
      llmRows.push({
        name,
        set: isEnvSet(name, env),
        optional: false,
        sourceId: provider.id,
        inUse: provider.id === activeLlmId,
      });
    }
    for (const name of provider.optionalEnv ?? []) {
      llmRows.push({
        name,
        set: isEnvSet(name, env),
        optional: true,
        sourceId: provider.id,
        inUse: provider.id === activeLlmId,
      });
    }
  }

  if (llmRows.length > 0) {
    const activeProvider = llmProviders.find((p) => p.id === activeLlmId);
    const activeIsStub = activeLlmId === "stub";
    const activeReady =
      activeIsStub ||
      (activeProvider !== undefined &&
        activeProvider.requiredEnv.length > 0 &&
        allRequiredSet(activeProvider.requiredEnv, env));

    let status: KeyGroupStatus;
    let statusDetail: string | undefined;
    if (activeReady && !activeIsStub) {
      status = "ready";
      statusDetail = activeProvider?.label;
    } else if (anyLlmReady) {
      // Active provider is stub or missing keys, but another provider can run.
      status = "ready";
      statusDetail = readyLlmLabel;
    } else if (activeIsStub) {
      status = "stub";
    } else {
      status = "needsKeys";
    }

    groups.push({
      id: "llm",
      label: copy.settings.keysLlmHeading,
      blurb: copy.settings.keysLlmBlurb,
      sourceId: anyLlmReady
        ? (llmProviders.find((p) => p.label === readyLlmLabel)?.id ??
          activeLlmId)
        : "stub",
      status,
      statusDetail,
      rows: llmRows,
    });
  }

  // Delivery channels that need keys (file needs none — skip).
  for (const channel of deliveryChannels) {
    if (channel.requiredEnv.length === 0) {
      continue;
    }
    const selected = channel.id === activeDeliveryId;
    const ready = allRequiredSet(channel.requiredEnv, env);
    let status: KeyGroupStatus;
    if (ready) {
      status = "ready";
    } else if (selected) {
      status = "needsKeys";
    } else {
      status = "unused";
    }

    groups.push({
      id: `delivery:${channel.id}`,
      label: channel.label,
      sourceId: channel.id,
      status,
      rows: [
        ...channel.requiredEnv.map((name) => ({
          name,
          set: isEnvSet(name, env),
          optional: false,
          sourceId: channel.id,
          inUse: selected,
        })),
        ...(channel.optionalEnv ?? []).map((name) => ({
          name,
          set: isEnvSet(name, env),
          optional: true,
          sourceId: channel.id,
          inUse: selected,
        })),
      ],
    });
  }

  groups.push({
    id: "other",
    label: copy.settings.keysOtherHeading,
    blurb: copy.settings.keysOtherBlurb,
    sourceId: "rooster",
    status: isEnvSet("ROOSTER_RUN_TOKEN", env) ? "ready" : "unused",
    rows: [
      {
        name: "ROOSTER_RUN_TOKEN",
        set: isEnvSet("ROOSTER_RUN_TOKEN", env),
        optional: true,
        sourceId: "rooster",
        inUse: false,
      },
    ],
  });

  return groups;
}

function KeyStatusBadge({
  set,
  optional,
  inUse,
  softMissing,
}: {
  set: boolean;
  optional: boolean;
  inUse: boolean;
  /** Soften missing when the group is unused / alternative not required. */
  softMissing: boolean;
}) {
  const parts: string[] = [
    set ? copy.settings.keysSet : copy.settings.keysMissing,
  ];
  if (optional) {
    parts.push(copy.settings.keysOptional);
  }
  if (inUse && set) {
    parts.push(copy.settings.keysInUse);
  }

  const mutedMissing = optional || softMissing;

  return (
    <span
      className={
        set
          ? "metric-mono text-xs text-ok"
          : mutedMissing
            ? "metric-mono text-xs text-muted"
            : "metric-mono text-xs text-accent"
      }
    >
      {parts.join(" · ")}
    </span>
  );
}

function readSiteHealthSites(
  connectors: Array<{ id: string; config: Record<string, unknown> }>,
): SiteHealthSite[] {
  const entry = connectors.find((connector) => connector.id === "site-health");
  const raw = entry?.config?.sites;
  if (!Array.isArray(raw)) {
    return [];
  }
  const sites: SiteHealthSite[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      "url" in item &&
      typeof (item as { url: unknown }).url === "string"
    ) {
      const url = (item as { url: string }).url.trim();
      if (!url) {
        continue;
      }
      const name =
        "name" in item && typeof (item as { name: unknown }).name === "string"
          ? (item as { name: string }).name.trim()
          : undefined;
      sites.push(name ? { url, name } : { url });
    }
  }
  return sites;
}

export default async function SettingsPage() {
  const rootDir = resolveRootDir();
  const loaded = await loadConfig({ rootDir });
  const timezone = loaded.config.timezone;
  const scheduleHint = loaded.config.scheduleHint ?? "0 7 * * *";
  const llmProvider = loaded.config.llm.provider;
  const llmModel = loaded.config.llm.model;
  const deliveryChannel = loaded.config.delivery.channel;

  const keyGroups = collectKeyGroups(loaded);
  const hasInstalledConnectors = loaded.config.connectors.length > 0;
  const ga4 = await loadGa4PickerState(loaded, rootDir);
  const gsc = await loadGscPickerState(loaded, rootDir);
  const siteHealthSites = readSiteHealthSites(loaded.config.connectors);
  const keysNeedingAttention = keyGroups.filter(
    (group) => group.status === "needsKeys",
  ).length;
  const keysDefaultOpen =
    !hasInstalledConnectors || keysNeedingAttention > 0;
  const keysFoldSummary = !hasInstalledConnectors
    ? copy.settings.keysFoldEmpty
    : keysNeedingAttention > 0
      ? copy.settings.keysFoldAttention(keysNeedingAttention)
      : copy.settings.keysFoldReady(keyGroups.length);
  const spendSummary = await summarizeBriefSpend(
    rootDir,
    timezone,
    new Date(),
  );

  return (
    <main className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {copy.settings.title}
      </h1>

      {/* Keys: read-only status board — no secret inputs on purpose. */}
      <SettingsSectionFold
        title={copy.settings.keysHeading}
        icon={<SettingsKeysIcon />}
        summary={keysFoldSummary}
        defaultOpen={keysDefaultOpen}
        className="border-border bg-surface/80"
      >
        <p className="text-sm text-muted">{copy.settings.keysBlurb}</p>
        <p className="text-xs text-muted">{copy.settings.keysDocHint}</p>
        {!hasInstalledConnectors ? (
          <p className="text-sm text-muted">{copy.settings.keysEmpty}</p>
        ) : null}
        {hasInstalledConnectors ? (
          <ul className="flex flex-col gap-5 border-t border-border pt-3">
            {keyGroups.map((group) => (
              <li key={group.id}>
                <FoldableKeyGroup
                  defaultOpen={group.status !== "ready"}
                  leading={
                    <div className="flex min-w-0 items-center gap-2">
                      <SourceLogo
                        sourceId={group.sourceId}
                        className="size-4 shrink-0 text-muted"
                      />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {group.label}
                        </p>
                        {group.blurb ? (
                          <p className="text-xs text-muted">{group.blurb}</p>
                        ) : null}
                      </div>
                    </div>
                  }
                  trailing={
                    <span className={groupStatusClass(group.status)}>
                      {groupStatusLabel(group.status)}
                      {group.statusDetail ? ` · ${group.statusDetail}` : ""}
                    </span>
                  }
                >
                  <ul className="divide-y divide-border border-t border-border">
                    {group.rows.map((row) => (
                      <li
                        key={`${group.id}:${row.name}`}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                      >
                        <div className="flex min-w-0 items-start gap-2.5 pl-5">
                          <SourceLogo
                            sourceId={row.sourceId}
                            className="mt-0.5 size-4 shrink-0 text-muted"
                          />
                          <span className="metric-mono text-foreground">
                            {row.name}
                          </span>
                        </div>
                        <KeyStatusBadge
                          set={row.set}
                          optional={row.optional}
                          inUse={row.inUse}
                          softMissing={
                            group.status === "unused" ||
                            group.status === "stub" ||
                            (group.id === "llm" &&
                              group.status === "ready" &&
                              !row.inUse)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </FoldableKeyGroup>
              </li>
            ))}
          </ul>
        ) : null}
      </SettingsSectionFold>

      {loaded.config.connectors.some((connector) => connector.id === "ga4") ? (
        <Ga4PropertyPicker
          credentialsReady={ga4.credentialsReady}
          initialProperties={ga4.properties}
          initialSelectedIds={ga4.selectedIds}
          initialError={ga4.error}
        />
      ) : null}

      {loaded.config.connectors.some((connector) => connector.id === "gsc") ? (
        <GscSitePicker
          credentialsReady={gsc.credentialsReady}
          initialSites={gsc.sites}
          initialSelectedUrls={gsc.selectedUrls}
          initialError={gsc.error}
        />
      ) : null}

      {loaded.config.connectors.some(
        (connector) => connector.id === "site-health",
      ) ? (
        <SiteHealthOriginsEditor initialSites={siteHealthSites} />
      ) : null}

      <AudioPreferences
        wakeSound={loaded.config.wakeSound}
        ttsEnabled={loaded.config.ttsEnabled}
        ttsMode={loaded.config.ttsMode}
        ttsVoice={loaded.config.ttsVoice}
        operatorName={loaded.config.operatorName}
      />

      <EstimatedSpendSection summary={spendSummary} />

      {/* Preferences: editable, never secrets — stays expanded. */}
      <section className="flex flex-col gap-3 rounded border border-accent/25 bg-surface-raised/80 p-4 backdrop-blur-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex text-muted">
              <SettingsPreferencesIcon />
            </span>
            <h2 className="text-lg font-medium leading-none text-foreground">
              {copy.settings.preferencesHeading}
            </h2>
          </div>
          <p className="text-sm text-muted">{copy.settings.preferencesBlurb}</p>
        </div>
        <PreferencesForm
          timezone={timezone}
          weatherLocation={loaded.config.weatherLocation}
          operatorName={loaded.config.operatorName}
          scheduleHint={scheduleHint}
          llmProvider={llmProvider}
          llmModel={llmModel}
          deliveryChannel={deliveryChannel}
          systemPrompt={
            loaded.config.prompts.system?.trim() || copy.briefSystemPrompt
          }
          overviewPrompt={loaded.config.prompts.overview}
          promptHistory={loaded.config.prompts.history}
          llmProviders={llmProviders.map((p) => ({
            id: p.id,
            label: p.label,
            defaultModel: p.defaultModel,
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
