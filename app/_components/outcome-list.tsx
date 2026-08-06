import { ErrorDetails } from "@/app/_components/error-details";
import { friendlyOutcomeLine } from "@/app/_lib/format";
import { copy } from "@/src/copy";
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
        {outcomes.map((outcome) => {
          const lines = outcome.result?.lines;
          const hasLines = lines != null && lines.length > 0;
          const statusClass =
            outcome.status === "ok" ? "text-foreground" : "text-accent";

          return (
            <li
              key={outcome.connectorId}
              className="rounded border border-border bg-surface px-3 py-2 text-sm"
            >
              {hasLines ? (
                <details className="group/outcome">
                  <summary
                    className={`flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden ${statusClass}`}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted transition group-open/outcome:rotate-90"
                    >
                      <path
                        d="M6 3.5 10.5 8 6 12.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {friendlyOutcomeLine(outcome)}
                  </summary>
                  <pre className="metric-mono mt-2 max-h-48 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-2 text-xs text-muted [overflow-wrap:anywhere]">
                    {lines.join("\n")}
                  </pre>
                </details>
              ) : (
                <>
                  <p className={statusClass}>{friendlyOutcomeLine(outcome)}</p>
                  {outcome.error ? (
                    <ErrorDetails
                      error={outcome.error}
                      summaryClassName="cursor-pointer text-xs text-foreground/70"
                    />
                  ) : null}
                </>
              )}
            </li>
          );
        })}
        {llmFailed ? (
          <li className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
            <p className="text-danger">{copy.latest.llmFallback}</p>
            {llmError ? (
              <ErrorDetails
                error={llmError}
                summaryClassName="cursor-pointer text-xs text-foreground/70"
              />
            ) : null}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
