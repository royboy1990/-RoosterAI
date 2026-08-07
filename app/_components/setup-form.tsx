"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveConfig } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import {
  Ga4PropertyPicker,
  type Ga4PropertyPickerProps,
} from "@/app/_components/ga4-property-picker";
import type { LlmProviderOption } from "@/app/_components/preferences-form";
import { copy } from "@/src/copy";

export interface SetupFormProps {
  selectedConnectorIds: string[];
  connectors: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  llmProvider: string;
  llmModel: string;
  deliveryChannel: string;
  llmProviders: LlmProviderOption[];
  deliveryChannels: Array<{ id: string; label: string }>;
  ga4Picker: Omit<Ga4PropertyPickerProps, "embedded">;
}

export function SetupForm(props: SetupFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [llmProvider, setLlmProvider] = useState(props.llmProvider);
  const [llmModel, setLlmModel] = useState(props.llmModel);

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("setup", "1");
        setResult(null);
        startTransition(async () => {
          const next = await saveConfig(formData);
          setResult(next);
          if (next.ok) {
            router.push("/");
            router.refresh();
          }
        });
      }}
    >
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-foreground">
            {copy.setup.sourcesHeading}
          </h2>
          <p className="text-sm text-muted">{copy.setup.sourcesBlurb}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {props.connectors.map((connector) => {
            const checked = props.selectedConnectorIds.includes(connector.id);
            return (
              <li key={connector.id}>
                <label className="flex cursor-pointer gap-3 rounded border border-border bg-surface/80 px-3 py-3 text-sm backdrop-blur-md">
                  <input
                    type="checkbox"
                    name="connector"
                    value={connector.id}
                    defaultChecked={checked}
                    className="mt-1"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                      {connector.label}
                    </span>
                    <span className="text-muted">{connector.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <Ga4PropertyPicker {...props.ga4Picker} embedded />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-foreground">
          {copy.setup.modelHeading}
        </h2>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{copy.setup.llmProvider}</span>
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
          <span className="text-muted">{copy.setup.llmModel}</span>
          <input
            name="llmModel"
            value={llmModel}
            onChange={(event) => setLlmModel(event.target.value)}
            className="metric-mono rounded border border-border bg-background px-3 py-2 text-foreground"
          />
          <ul className="metric-mono text-xs text-muted">
            <li className="mb-1 font-sans text-muted">
              {copy.setup.llmDefaultsHint}
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
          <span className="text-muted">{copy.setup.deliveryChannel}</span>
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
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dim disabled:opacity-70"
        >
          {isPending ? copy.pendingGather : copy.setup.save}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            router.push("/");
          }}
          className="rounded-md border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/50 disabled:opacity-70"
        >
          {copy.setup.skip}
        </button>
      </div>

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
