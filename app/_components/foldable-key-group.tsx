"use client";

import { useState, type ReactNode } from "react";

export function FoldableKeyGroup({
  defaultOpen,
  leading,
  trailing,
  children,
}: {
  defaultOpen: boolean;
  leading: ReactNode;
  trailing: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="group/keys"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted transition group-open/keys:rotate-90"
          >
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {leading}
        </div>
        {trailing}
      </summary>
      <div className="pt-1.5">{children}</div>
    </details>
  );
}
