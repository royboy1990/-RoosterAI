"use client";

import { useState, useTransition } from "react";
import { saveSiteHealthSites } from "@/app/actions";
import type { ActionResult } from "@/app/_lib/action-result";
import { ErrorDetails } from "@/app/_components/error-details";
import { SettingsSeoIcon } from "@/app/_components/settings-section-icons";
import { SettingsSectionFold } from "@/app/_components/settings-section-fold";
import { copy } from "@/src/copy";
import { formatSiteHealthSitesText } from "@/src/core/connectors/site-health-shared";

export type SiteHealthOriginsEditorProps = {
  initialSites: Array<{ url: string; name?: string }>;
};

export function SiteHealthOriginsEditor(props: SiteHealthOriginsEditorProps) {
  const [text, setText] = useState(() =>
    formatSiteHealthSitesText(props.initialSites),
  );
  const [saveResult, setSaveResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const initialCount = props.initialSites.length;
  const needsAttention = initialCount === 0;

  return (
    <SettingsSectionFold
      title={copy.siteHealth.heading}
      icon={<SettingsSeoIcon />}
      summary={
        initialCount > 0
          ? copy.siteHealth.foldReady(initialCount)
          : copy.siteHealth.foldNeedsSetup
      }
      defaultOpen={needsAttention}
      className="border-accent/25 bg-surface-raised/80"
    >
      <p className="text-sm text-muted">{copy.siteHealth.blurb}</p>
      {needsAttention ? (
        <p className="text-sm text-muted">{copy.siteHealth.emptyHint}</p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="sr-only">{copy.siteHealth.heading}</span>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSaveResult(null);
          }}
          rows={6}
          placeholder={copy.siteHealth.placeholder}
          className="metric-mono rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setSaveResult(null);
            startTransition(async () => {
              const next = await saveSiteHealthSites(text);
              setSaveResult(next);
            });
          }}
          className="w-fit rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 disabled:opacity-70"
        >
          {isPending ? copy.pendingGather : copy.siteHealth.save}
        </button>
        {saveResult ? (
          <div className="min-w-0 text-sm">
            <p className={saveResult.ok ? "text-ok" : "text-danger"}>
              {saveResult.message}
            </p>
            {!saveResult.ok ? <ErrorDetails error={saveResult.error} /> : null}
          </div>
        ) : null}
      </div>
    </SettingsSectionFold>
  );
}
