import { copy } from "@/src/copy";
import { friendlyOutcomeLine } from "@/app/_lib/format";
import type { ConnectorOutcome } from "@/src/core/types";

export function OutcomeList({
  outcomes,
  llmFailed,
  llmError,
}: {
  outcomes: ConnectorOutcome[];
  llmFailed?: boolean;
  llmError?: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted">
        {copy.latest.outcomesHeading}
      </h2>
      <ul className="flex flex-col gap-2">
        {outcomes.map((outcome) => (
          <li
            key={outcome.connectorId}
            className="rounded border border-border bg-surface px-3 py-2 text-sm"
          >
            <p
              className={
                outcome.status === "ok" ? "text-foreground" : "text-accent"
              }
            >
              {friendlyOutcomeLine(outcome)}
            </p>
            {outcome.error ? (
              <details className="mt-1 text-muted">
                <summary className="cursor-pointer text-xs text-foreground/70">
                  {copy.latest.errorDetailsSummary}
                </summary>
                <pre className="metric-mono mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-danger">
                  {outcome.error}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
        {llmFailed ? (
          <li className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
            <p className="text-danger">{copy.latest.llmFallback}</p>
            {llmError ? (
              <details className="mt-1 text-muted">
                <summary className="cursor-pointer text-xs text-foreground/70">
                  {copy.latest.errorDetailsSummary}
                </summary>
                <pre className="metric-mono mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-danger">
                  {llmError}
                </pre>
              </details>
            ) : null}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
