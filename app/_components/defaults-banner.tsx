"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/src/copy";

const STORAGE_KEY = "rooster:defaults-banner-dismissed";

export function DefaultsBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, []);

  if (!ready || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded border border-accent/30 bg-surface-raised px-3 py-2 text-sm text-muted"
    >
      <p>
        {copy.defaultsBanner.message}{" "}
        <Link
          href="/setup"
          className="text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
        >
          {copy.defaultsBanner.setupLink}
        </Link>
      </p>
      <button
        type="button"
        className="text-xs text-muted hover:text-foreground"
        onClick={() => {
          try {
            sessionStorage.setItem(STORAGE_KEY, "1");
          } catch {
            // sessionStorage may be unavailable — still dismiss for this render.
          }
          setDismissed(true);
        }}
      >
        {copy.defaultsBanner.dismiss}
      </button>
    </div>
  );
}
