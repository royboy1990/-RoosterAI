"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  installConnector,
  removeConnector,
  setConnectorMuted,
  wakeTheFlock,
  type ActionResult,
} from "@/app/actions";
import { copy } from "@/src/copy";
import type { ProviderState } from "@/src/core/registry";

export type CoopCardView = {
  id: string;
  label: string;
  description: string;
  tags: readonly string[];
  setupDocs: string;
  requiredEnv: readonly string[];
  optionalEnv?: readonly string[];
  state: ProviderState | "unknown";
  missingEnv: readonly string[];
  unknown?: boolean;
};

function docsHref(setupDocs: string): string {
  if (setupDocs.startsWith("http://") || setupDocs.startsWith("https://")) {
    return setupDocs;
  }
  const path = setupDocs.replace(/^\.\//, "");
  return `https://github.com/royboy1990/-RoosterAI/blob/main/${path}`;
}

function stateBadgeClass(state: CoopCardView["state"]): string {
  switch (state) {
    case "active":
      return "border-ok/40 text-ok";
    case "needsKeys":
      return "border-accent/50 text-accent";
    case "muted":
      return "border-border text-muted";
    case "unknown":
      return "border-danger/40 text-danger";
    default:
      return "border-border text-muted";
  }
}

function stateLabel(state: CoopCardView["state"]): string {
  if (state === "unknown") {
    return copy.coop.unknownLabel;
  }
  return copy.coop.state[state];
}

function matchesQuery(card: CoopCardView, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    card.label,
    card.description,
    card.id,
    ...card.tags,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function groupByPrimaryTag(
  cards: CoopCardView[],
): Array<{ tag: string; cards: CoopCardView[] }> {
  const groups = new Map<string, CoopCardView[]>();
  for (const card of cards) {
    const tag = card.tags[0] ?? "other";
    const list = groups.get(tag) ?? [];
    list.push(card);
    groups.set(tag, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, groupCards]) => ({ tag, cards: groupCards }));
}

export function CoopBoard({
  installed,
  available,
  firstRun = false,
}: {
  installed: CoopCardView[];
  available: CoopCardView[];
  firstRun?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter((card) => matchesQuery(card, q));
  }, [available, query]);

  const groupedAvailable = useMemo(
    () => groupByPrimaryTag(filteredAvailable),
    [filteredAvailable],
  );

  const run = (action: () => Promise<ActionResult>): void => {
    setResult(null);
    startTransition(async () => {
      const next = await action();
      setResult(next);
    });
  };

  return (
    <div className="flex flex-col gap-10">
      {firstRun ? (
        <section className="flex flex-col gap-3 rounded border border-accent/25 bg-surface-raised p-4">
          <p className="text-sm text-muted">{copy.coop.firstRunDemoHint}</p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setResult(null);
              startTransition(async () => {
                const next = await wakeTheFlock({ demo: true });
                setResult(next);
                if (next.ok) {
                  router.push("/");
                  router.refresh();
                }
              });
            }}
            className="w-fit rounded-md border border-accent/40 bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent disabled:opacity-70"
          >
            {isPending ? copy.pendingGather : copy.coop.firstRunDemo}
          </button>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-foreground">
          {copy.coop.installedHeading}
        </h2>
        {installed.length === 0 ? (
          <p className="text-sm text-muted">{copy.coop.installedEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {installed.map((card) => (
              <li
                key={card.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">
                      {card.label}
                    </span>
                    <span
                      className={`metric-mono rounded border px-1.5 py-0.5 text-[11px] ${stateBadgeClass(card.state)}`}
                    >
                      {stateLabel(card.state)}
                    </span>
                    <span className="metric-mono text-xs text-muted">
                      ({card.id})
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {card.unknown
                      ? copy.coop.unknownBlurb
                      : card.description}
                  </p>
                  {card.state === "needsKeys" && card.missingEnv.length > 0 ? (
                    <div className="flex flex-col gap-1 text-sm">
                      <p className="text-accent">
                        {copy.coop.missingKeys}:{" "}
                        <span className="metric-mono">
                          {card.missingEnv.join(", ")}
                        </span>
                      </p>
                      <a
                        href={docsHref(card.setupDocs)}
                        className="w-fit text-sm text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.coop.setupLink}
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      run(() =>
                        setConnectorMuted(card.id, card.state !== "muted"),
                      )
                    }
                    className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground transition hover:border-accent/50 disabled:opacity-70"
                  >
                    {card.state === "muted"
                      ? copy.coop.unmute
                      : copy.coop.mute}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => removeConnector(card.id))}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-70"
                  >
                    {copy.coop.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium text-foreground">
            {copy.coop.availableHeading}
          </h2>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.coop.searchPlaceholder}
            className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        {available.length === 0 ? (
          <p className="text-sm text-muted">{copy.coop.availableEmpty}</p>
        ) : filteredAvailable.length === 0 ? (
          <p className="text-sm text-muted">{copy.coop.noSearchMatches}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedAvailable.map(({ tag, cards }) => (
              <div key={tag} className="flex flex-col gap-2">
                <h3 className="metric-mono text-xs uppercase tracking-wide text-muted">
                  {tag}
                </h3>
                <ul className="flex flex-col divide-y divide-border border-y border-border">
                  {cards.map((card) => (
                    <li
                      key={card.id}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium text-foreground">
                            {card.label}
                          </span>
                          <span className="metric-mono text-xs text-muted">
                            ({card.id})
                          </span>
                        </div>
                        <p className="text-sm text-muted">{card.description}</p>
                        {card.requiredEnv.length > 0 ? (
                          <p className="text-xs text-muted">
                            {copy.coop.willNeed}:{" "}
                            <span className="metric-mono text-foreground/80">
                              {card.requiredEnv.join(", ")}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted">
                            {copy.coop.willNeed}: none
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => run(() => installConnector(card.id))}
                        className="w-fit rounded-md border border-accent/40 bg-surface-raised px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent disabled:opacity-70"
                      >
                        {copy.coop.install}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border pt-6 text-sm text-muted">
        <p>{copy.coop.contribute}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={docsHref("docs/CUSTOM-CONNECTORS.md")}
            className="text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
            target="_blank"
            rel="noreferrer"
          >
            {copy.coop.contributeDocs}
          </a>
          <a
            href={docsHref(".github/ISSUE_TEMPLATE/new-connector.md")}
            className="text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
            target="_blank"
            rel="noreferrer"
          >
            {copy.coop.contributeIssue}
          </a>
        </p>
      </footer>

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
    </div>
  );
}
