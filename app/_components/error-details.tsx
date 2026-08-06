import { copy } from "@/src/copy";

export function ErrorDetails({
  error,
  summaryClassName = "cursor-pointer text-foreground/80",
}: {
  error: string;
  summaryClassName?: string;
}) {
  return (
    <details className="mt-1 min-w-0 text-muted">
      <summary className={summaryClassName}>
        {copy.latest.errorDetailsSummary}
      </summary>
      <pre className="metric-mono mt-2 max-h-40 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-surface p-2 text-xs text-danger [overflow-wrap:anywhere]">
        {error}
      </pre>
    </details>
  );
}
