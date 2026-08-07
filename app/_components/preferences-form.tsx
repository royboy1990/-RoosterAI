"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { saveConfig } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import { copy } from "@/src/copy";
import {
  PROMPT_MAX_CHARS,
  type PromptHistoryEntry,
} from "@/src/core/prompts";

export interface LlmProviderOption {
  id: string;
  label: string;
  defaultModel: string;
}

export interface PreferencesFormProps {
  timezone: string;
  scheduleHint: string;
  llmProvider: string;
  llmModel: string;
  deliveryChannel: string;
  wakeSound: boolean;
  systemPrompt: string;
  overviewPrompt: string;
  promptHistory: PromptHistoryEntry[];
  llmProviders: LlmProviderOption[];
  deliveryChannels: Array<{ id: string; label: string }>;
}

function historyLabel(entry: PromptHistoryEntry): string {
  const when = new Date(entry.savedAt);
  const stamp = Number.isNaN(when.getTime())
    ? entry.savedAt
    : when.toLocaleString("en-US");
  const preview = (entry.overview.trim() || entry.system.trim() || "(empty)")
    .replace(/\s+/g, " ")
    .slice(0, 48);
  return `${stamp} — ${preview}${preview.length >= 48 ? "…" : ""}`;
}

export function PreferencesForm(props: PreferencesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [llmProvider, setLlmProvider] = useState(props.llmProvider);
  const [llmModel, setLlmModel] = useState(props.llmModel);
  const [wakeSound, setWakeSound] = useState(props.wakeSound);
  const [systemPrompt, setSystemPrompt] = useState(props.systemPrompt);
  const [overviewPrompt, setOverviewPrompt] = useState(props.overviewPrompt);
  const [timezone, setTimezone] = useState(props.timezone);
  const [historyId, setHistoryId] = useState(props.promptHistory[0]?.id ?? "");

  useEffect(() => {
    setTimezone(props.timezone);
  }, [props.timezone]);

  useEffect(() => {
    setWakeSound(props.wakeSound);
  }, [props.wakeSound]);

  useEffect(() => {
    const latest = props.promptHistory[0]?.id ?? "";
    if (!latest) {
      setHistoryId("");
      return;
    }
    if (!props.promptHistory.some((entry) => entry.id === historyId)) {
      setHistoryId(latest);
    }
  }, [props.promptHistory, historyId]);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setResult(null);
        startTransition(async () => {
          const next = await saveConfig(formData);
          setResult(next);
          if (next.ok) {
            router.refresh();
          }
        });
      }}
    >
      <div className="flex flex-col gap-1 rounded border border-border bg-background px-3 py-3 text-sm">
        <span className="font-medium text-foreground">
          {copy.settings.connectorsHeading}
        </span>
        <p className="text-muted">{copy.settings.connectorsManagedInCoop}</p>
        <Link
          href="/coop"
          className="w-fit text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
        >
          {copy.settings.openCoop}
        </Link>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.llmProvider}</span>
        <select
          name="llmProvider"
          value={llmProvider}
          onChange={(event) => {
            const nextId = event.target.value;
            setLlmProvider(nextId);
            const match = props.llmProviders.find((p) => p.id === nextId);
            if (match) {
              setLlmModel(match.defaultModel);
            }
          }}
          className="rounded border border-border bg-background px-3 py-2 text-foreground"
        >
          {props.llmProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label} ·{" "}
              {provider.id === llmProvider ? llmModel : provider.defaultModel}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.llmModel}</span>
        <input
          name="llmModel"
          value={llmModel}
          onChange={(event) => setLlmModel(event.target.value)}
          className="metric-mono rounded border border-border bg-background px-3 py-2 text-foreground"
        />
        <ul className="metric-mono text-xs text-muted">
          <li className="mb-1 font-sans text-muted">
            {copy.settings.llmDefaultsHint}
          </li>
          {props.llmProviders
            .filter((provider) => provider.id !== "stub")
            .map((provider) => (
              <li key={provider.id}>
                {provider.label}: {provider.defaultModel}
              </li>
            ))}
        </ul>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.deliveryChannel}</span>
        <select
          name="deliveryChannel"
          defaultValue={props.deliveryChannel}
          className="rounded border border-border bg-background px-3 py-2 text-foreground"
        >
          {props.deliveryChannels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="wakeSound"
          value="1"
          checked={wakeSound}
          onChange={(event) => setWakeSound(event.target.checked)}
          className="mt-1"
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium text-foreground">
            {copy.settings.wakeSound}
          </span>
          <span className="text-muted">{copy.settings.wakeSoundHint}</span>
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.timezone}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="metric-mono min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-foreground"
            placeholder="Asia/Jerusalem"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className="shrink-0 rounded border border-border px-3 py-2 text-xs text-muted hover:border-accent/40 hover:text-foreground"
            onClick={() => {
              try {
                const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (zone) {
                  setTimezone(zone);
                }
              } catch {
                // Intl may be unavailable in rare environments.
              }
            }}
          >
            {copy.settings.timezoneUseBrowser}
          </button>
        </div>
        <p className="text-xs text-muted">{copy.settings.timezoneHint}</p>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.scheduleHint}</span>
        <input
          name="scheduleHint"
          defaultValue={props.scheduleHint}
          className="metric-mono rounded border border-border bg-background px-3 py-2 text-foreground"
          placeholder="0 7 * * *"
        />
      </label>

      <div className="flex flex-col gap-4 rounded border border-border bg-background px-3 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {copy.settings.promptsHeading}
          </span>
          <p className="text-sm text-muted">{copy.settings.promptsBlurb}</p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{copy.settings.overviewPrompt}</span>
          <textarea
            name="overviewPrompt"
            value={overviewPrompt}
            onChange={(event) =>
              setOverviewPrompt(event.target.value.slice(0, PROMPT_MAX_CHARS))
            }
            rows={10}
            maxLength={PROMPT_MAX_CHARS}
            className="min-h-40 resize-y rounded border border-border bg-surface px-3 py-2 font-sans text-foreground"
            placeholder="e.g. Lead with revenue and traffic anomalies. Mention only blockers from GitHub. Skip calendar fluff unless meetings conflict."
          />
          <span className="metric-mono text-xs text-muted">
            {copy.settings.promptChars(overviewPrompt.length, PROMPT_MAX_CHARS)}
          </span>
          <p className="text-xs text-muted">{copy.settings.overviewPromptHint}</p>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted">{copy.settings.systemPrompt}</span>
            <button
              type="button"
              className="text-xs text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
              onClick={() => setSystemPrompt(copy.briefSystemPrompt)}
            >
              {copy.settings.promptHistoryReset}
            </button>
          </div>
          <textarea
            name="systemPrompt"
            value={systemPrompt}
            onChange={(event) =>
              setSystemPrompt(event.target.value.slice(0, PROMPT_MAX_CHARS))
            }
            rows={8}
            maxLength={PROMPT_MAX_CHARS}
            className="min-h-32 resize-y rounded border border-border bg-surface px-3 py-2 font-sans text-foreground"
          />
          <span className="metric-mono text-xs text-muted">
            {copy.settings.promptChars(systemPrompt.length, PROMPT_MAX_CHARS)}
          </span>
          <p className="text-xs text-muted">{copy.settings.systemPromptHint}</p>
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <span className="text-muted">{copy.settings.promptHistory}</span>
          {props.promptHistory.length === 0 ? (
            <p className="text-xs text-muted">
              {copy.settings.promptHistoryEmpty}
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={historyId}
                onChange={(event) => setHistoryId(event.target.value)}
                className="min-w-0 flex-1 rounded border border-border bg-surface px-3 py-2 text-foreground"
              >
                {props.promptHistory.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {historyLabel(entry)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="w-fit rounded-md border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent/50"
                onClick={() => {
                  const entry = props.promptHistory.find(
                    (item) => item.id === historyId,
                  );
                  if (!entry) {
                    return;
                  }
                  setSystemPrompt(entry.system || copy.briefSystemPrompt);
                  setOverviewPrompt(entry.overview);
                }}
              >
                {copy.settings.promptHistoryLoad}
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-md border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 disabled:opacity-70"
      >
        {isPending ? copy.pendingGather : copy.settings.save}
      </button>

      {result ? (
        <div className="min-w-0 text-sm">
          <p className={result.ok ? "text-ok" : "text-danger"}>
            {result.message}
          </p>
          {!result.ok ? <ErrorDetails error={result.error} /> : null}
        </div>
      ) : null}
    </form>
  );
}
