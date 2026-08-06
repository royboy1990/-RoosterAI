"use client";

import { useTransition } from "react";
import { saveConfig, type ActionResult } from "@/app/actions";
import { copy } from "@/src/copy";
import { useState } from "react";

export interface PreferencesFormProps {
  timezone: string;
  scheduleHint: string;
  llmProvider: string;
  llmModel: string;
  deliveryChannel: string;
  connectors: Array<{ id: string; label: string; enabled: boolean }>;
  llmProviders: Array<{ id: string; label: string }>;
  deliveryChannels: Array<{ id: string; label: string }>;
}

export function PreferencesForm(props: PreferencesFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

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
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">
          {copy.settings.connectorsHeading}
        </legend>
        <div className="flex flex-col gap-2">
          {props.connectors.map((connector) => (
            <label
              key={connector.id}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                name="connectorId"
                value={connector.id}
                defaultChecked={connector.enabled}
                className="accent-accent"
              />
              <span>{connector.label}</span>
              <span className="metric-mono text-xs text-muted">
                ({connector.id})
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.llmProvider}</span>
        <select
          name="llmProvider"
          defaultValue={props.llmProvider}
          className="rounded border border-border bg-background px-3 py-2 text-foreground"
        >
          {props.llmProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.llmModel}</span>
        <input
          name="llmModel"
          defaultValue={props.llmModel}
          className="metric-mono rounded border border-border bg-background px-3 py-2 text-foreground"
        />
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

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">{copy.settings.timezone}</span>
        <input
          name="timezone"
          defaultValue={props.timezone}
          className="metric-mono rounded border border-border bg-background px-3 py-2 text-foreground"
          placeholder="UTC"
        />
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

      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-md border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 disabled:opacity-70"
      >
        {isPending ? copy.pendingGather : copy.settings.save}
      </button>

      {result ? (
        <div className="text-sm">
          <p className={result.ok ? "text-ok" : "text-danger"}>
            {result.message}
          </p>
          {!result.ok ? (
            <details className="mt-1 text-muted">
              <summary className="cursor-pointer text-foreground/80">
                {copy.latest.errorDetailsSummary}
              </summary>
              <pre className="metric-mono mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-border bg-surface p-2 text-xs text-danger">
                {result.error}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
