"use client";

import { useMemo, useState, useTransition } from "react";
import { listGa4Properties, saveGa4Properties } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import { copy } from "@/src/copy";
import type { Ga4PropertyInfo } from "@/src/core/connectors/ga4-shared";

export type Ga4PropertyPickerProps = {
  credentialsReady: boolean;
  initialProperties: Ga4PropertyInfo[];
  initialSelectedIds: string[];
  initialError?: string | null;
  /** When true, checkboxes participate in a parent form via name=ga4Property. */
  embedded?: boolean;
};

type AccountGroup = {
  accountId: string;
  accountName: string;
  properties: Ga4PropertyInfo[];
};

function groupByAccount(properties: Ga4PropertyInfo[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>();
  for (const property of properties) {
    const key = property.accountId || property.accountName;
    const existing = map.get(key);
    if (existing) {
      existing.properties.push(property);
      continue;
    }
    map.set(key, {
      accountId: property.accountId,
      accountName: property.accountName,
      properties: [property],
    });
  }
  return [...map.values()];
}

export function Ga4PropertyPicker(props: Ga4PropertyPickerProps) {
  const [properties, setProperties] = useState(props.initialProperties);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(props.initialSelectedIds),
  );
  const [listError, setListError] = useState<string | null>(
    props.initialError ?? null,
  );
  const [saveResult, setSaveResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => groupByAccount(properties), [properties]);
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of properties) {
      map.set(property.id, property.name);
    }
    return map;
  }, [properties]);

  if (!props.credentialsReady) {
    return (
      <section className="flex flex-col gap-2 rounded border border-border bg-surface p-4">
        <h2 className="text-lg font-medium text-foreground">
          {copy.ga4.heading}
        </h2>
        <p className="text-sm text-muted">{copy.ga4.credentialsMissing}</p>
      </section>
    );
  }

  const toggle = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSaveResult(null);
  };

  const selectAll = (): void => {
    setSelectedIds(new Set(properties.map((property) => property.id)));
    setSaveResult(null);
  };

  const selectNone = (): void => {
    setSelectedIds(new Set());
    setSaveResult(null);
  };

  return (
    <section className="flex flex-col gap-4 rounded border border-accent/25 bg-surface-raised p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-foreground">
          {copy.ga4.heading}
        </h2>
        <p className="text-sm text-muted">{copy.ga4.blurb}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="metric-mono text-xs text-muted">
          {copy.ga4.selectedCount(selectedIds.size)}
        </span>
        <button
          type="button"
          onClick={selectAll}
          disabled={isPending || properties.length === 0}
          className="text-foreground underline decoration-border underline-offset-2 hover:decoration-accent disabled:opacity-50"
        >
          {copy.ga4.selectAll}
        </button>
        <button
          type="button"
          onClick={selectNone}
          disabled={isPending || selectedIds.size === 0}
          className="text-foreground underline decoration-border underline-offset-2 hover:decoration-accent disabled:opacity-50"
        >
          {copy.ga4.selectNone}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setListError(null);
            startTransition(async () => {
              const next = await listGa4Properties();
              if (!next.ok) {
                setListError(next.error);
                return;
              }
              setProperties(next.properties);
            });
          }}
          className="text-muted underline decoration-border underline-offset-2 hover:text-foreground hover:decoration-accent disabled:opacity-50"
        >
          {copy.ga4.refresh}
        </button>
      </div>

      {listError ? (
        <div className="min-w-0 text-sm text-danger">
          <p>{copy.ga4.loadFailed}</p>
          <p className="mt-1 text-muted">{copy.ga4.loadFailedHint}</p>
          <ErrorDetails error={listError} />
        </div>
      ) : null}

      {!listError && properties.length === 0 ? (
        <p className="text-sm text-muted">{copy.ga4.empty}</p>
      ) : null}

      <div className="flex max-h-80 flex-col gap-4 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.accountId || group.accountName} className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {copy.ga4.accountLabel} · {group.accountName}
              {group.accountId ? (
                <span className="metric-mono ml-2 normal-case tracking-normal">
                  {group.accountId}
                </span>
              ) : null}
            </p>
            <ul className="divide-y divide-border border border-border bg-background">
              {group.properties.map((property) => {
                const checked = selectedIds.has(property.id);
                return (
                  <li key={property.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm transition hover:bg-surface">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggle(property.id)}
                        {...(props.embedded
                          ? {
                              name: "ga4Property",
                              value: property.id,
                            }
                          : {})}
                      />
                      {props.embedded && checked ? (
                        <input
                          type="hidden"
                          name={`ga4PropertyName:${property.id}`}
                          value={property.name}
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium text-foreground">
                          {property.name}
                        </span>
                        <span className="metric-mono text-xs text-muted">
                          {property.id}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {!props.embedded ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setSaveResult(null);
              startTransition(async () => {
                const payload = [...selectedIds].map((id) => ({
                  id,
                  name: nameById.get(id) ?? "",
                }));
                const next = await saveGa4Properties(payload);
                setSaveResult(next);
              });
            }}
            className="w-fit rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 disabled:opacity-70"
          >
            {isPending ? copy.pendingGather : copy.ga4.save}
          </button>
          {saveResult ? (
            <div className="min-w-0 text-sm">
              <p className={saveResult.ok ? "text-ok" : "text-danger"}>
                {saveResult.message}
              </p>
              {!saveResult.ok ? (
                <ErrorDetails error={saveResult.error} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
