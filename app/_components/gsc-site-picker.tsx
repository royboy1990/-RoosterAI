"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { listGscSites, saveGscSites } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import { SettingsSeoIcon } from "@/app/_components/settings-section-icons";
import { SettingsSectionFold } from "@/app/_components/settings-section-fold";
import { copy } from "@/src/copy";
import type { GscSiteInfo } from "@/src/core/connectors/gsc-shared";

export type GscSitePickerProps = {
  credentialsReady: boolean;
  initialSites: GscSiteInfo[];
  initialSelectedUrls: string[];
  initialError?: string | null;
  /** When true, checkboxes participate in a parent form via name=gscSite. */
  embedded?: boolean;
};

function GscShell({
  embedded,
  defaultOpen,
  summary,
  children,
}: {
  embedded: boolean;
  defaultOpen: boolean;
  summary: ReactNode;
  children: ReactNode;
}) {
  if (embedded) {
    return (
      <section className="flex flex-col gap-4 rounded border border-accent/25 bg-surface-raised/80 p-4 backdrop-blur-md">
        {children}
      </section>
    );
  }

  return (
    <SettingsSectionFold
      title={copy.gsc.heading}
      icon={<SettingsSeoIcon />}
      summary={summary}
      defaultOpen={defaultOpen}
      className="border-accent/25 bg-surface-raised/80"
    >
      {children}
    </SettingsSectionFold>
  );
}

export function GscSitePicker(props: GscSitePickerProps) {
  const embedded = props.embedded ?? false;
  const [sites, setSites] = useState(props.initialSites);
  const [selectedUrls, setSelectedUrls] = useState(
    () => new Set(props.initialSelectedUrls),
  );
  const [listError, setListError] = useState<string | null>(
    props.initialError ?? null,
  );
  const [saveResult, setSaveResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameByUrl = useMemo(() => {
    const map = new Map<string, string>();
    for (const site of sites) {
      map.set(site.siteUrl, site.siteUrl);
    }
    return map;
  }, [sites]);

  const needsAttention =
    !props.credentialsReady ||
    props.initialSelectedUrls.length === 0 ||
    Boolean(props.initialError);

  if (!props.credentialsReady) {
    return (
      <GscShell
        embedded={embedded}
        defaultOpen
        summary={copy.gsc.foldNeedsSetup}
      >
        {embedded ? (
          <h2 className="text-lg font-medium text-foreground">
            {copy.gsc.heading}
          </h2>
        ) : null}
        <p className="text-sm text-muted">{copy.gsc.credentialsMissing}</p>
      </GscShell>
    );
  }

  const toggle = (siteUrl: string): void => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(siteUrl)) {
        next.delete(siteUrl);
      } else {
        next.add(siteUrl);
      }
      return next;
    });
    setSaveResult(null);
  };

  const selectAll = (): void => {
    setSelectedUrls(new Set(sites.map((site) => site.siteUrl)));
    setSaveResult(null);
  };

  const selectNone = (): void => {
    setSelectedUrls(new Set());
    setSaveResult(null);
  };

  const body = (
    <>
      {embedded ? (
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-foreground">
            {copy.gsc.heading}
          </h2>
          <p className="text-sm text-muted">{copy.gsc.blurb}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">{copy.gsc.blurb}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="metric-mono text-xs text-muted">
          {copy.gsc.selectedCount(selectedUrls.size)}
        </span>
        <button
          type="button"
          onClick={selectAll}
          disabled={isPending || sites.length === 0}
          className="text-foreground underline decoration-border underline-offset-2 hover:decoration-accent disabled:opacity-50"
        >
          {copy.gsc.selectAll}
        </button>
        <button
          type="button"
          onClick={selectNone}
          disabled={isPending || selectedUrls.size === 0}
          className="text-foreground underline decoration-border underline-offset-2 hover:decoration-accent disabled:opacity-50"
        >
          {copy.gsc.selectNone}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setListError(null);
            startTransition(async () => {
              const next = await listGscSites();
              if (!next.ok) {
                setListError(next.error);
                return;
              }
              setSites(next.sites);
            });
          }}
          className="text-muted underline decoration-border underline-offset-2 hover:text-foreground hover:decoration-accent disabled:opacity-50"
        >
          {copy.gsc.refresh}
        </button>
      </div>

      {listError ? (
        <div className="min-w-0 text-sm text-danger">
          <p>{copy.gsc.loadFailed}</p>
          <p className="mt-1 text-muted">{copy.gsc.loadFailedHint}</p>
          <ErrorDetails error={listError} />
        </div>
      ) : null}

      {!listError && sites.length === 0 ? (
        <p className="text-sm text-muted">{copy.gsc.empty}</p>
      ) : null}

      <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto border border-border bg-background pr-1">
        {sites.map((site) => {
          const checked = selectedUrls.has(site.siteUrl);
          return (
            <li key={site.siteUrl}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm transition hover:bg-surface">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={() => toggle(site.siteUrl)}
                  {...(props.embedded
                    ? {
                        name: "gscSite",
                        value: site.siteUrl,
                      }
                    : {})}
                />
                {props.embedded && checked ? (
                  <input
                    type="hidden"
                    name={`gscSiteName:${site.siteUrl}`}
                    value={nameByUrl.get(site.siteUrl) ?? site.siteUrl}
                  />
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-foreground break-all">
                    {site.siteUrl}
                  </span>
                  <span className="metric-mono text-xs text-muted">
                    {copy.gsc.permissionLabel} · {site.permissionLevel}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {!props.embedded ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setSaveResult(null);
              startTransition(async () => {
                const payload = [...selectedUrls].map((siteUrl) => ({
                  siteUrl,
                  name: nameByUrl.get(siteUrl) ?? "",
                }));
                const next = await saveGscSites(payload);
                setSaveResult(next);
              });
            }}
            className="w-fit rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 disabled:opacity-70"
          >
            {isPending ? copy.pendingGather : copy.gsc.save}
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
    </>
  );

  return (
    <GscShell
      embedded={embedded}
      defaultOpen={needsAttention}
      summary={
        selectedUrls.size > 0
          ? copy.gsc.foldReady(selectedUrls.size)
          : copy.gsc.foldNeedsSetup
      }
    >
      {body}
    </GscShell>
  );
}
