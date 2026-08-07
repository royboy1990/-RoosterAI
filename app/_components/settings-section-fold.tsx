"use client";

import { useState, type ReactNode } from "react";

/**
 * Collapsible settings card. Controlled <details> — React 19 does not accept
 * defaultOpen on <details>, and uncontrolled open resets on server re-renders.
 * Keep Preferences outside this — primary edit surfaces stay expanded.
 */
export function SettingsSectionFold({
  title,
  summary,
  defaultOpen,
  className,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className={`group/section rounded border backdrop-blur-md ${className ?? "border-border bg-surface/80"}`}
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      {/* Avoid flex/gap on <details> — Chrome ::details-content keeps the gap when closed. */}
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <div className="inline-flex min-w-0 items-center gap-2">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted transition group-open/section:rotate-90"
          >
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h2 className="text-lg font-medium leading-none text-foreground">
            {title}
          </h2>
        </div>
        {summary ? (
          <span className="metric-mono text-xs leading-none text-muted">
            {summary}
          </span>
        ) : null}
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}
