import Link from "next/link";
import { copy } from "@/src/copy";
import type { CoopStatus } from "@/src/core/types";
import {
  coopStatusClass,
  coopStatusLabel,
  formatHeaderTime,
} from "@/app/_lib/format";
import { WakeButton } from "@/app/_components/wake-button";

export function SiteHeader({
  status,
  timezone,
  now,
}: {
  status: CoopStatus | null;
  timezone: string;
  now: Date;
}) {
  const time = formatHeaderTime(now, timezone);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-accent"
            >
              {copy.brand}
            </Link>
            <p className="metric-mono text-xs text-muted">
              [{time}] · {copy.coopStatus.label}:{" "}
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${coopStatusClass(status)}`}
              >
                {coopStatusLabel(status)}
              </span>
            </p>
          </div>
          <nav className="flex gap-4 text-sm text-muted">
            <Link href="/" className="hover:text-foreground">
              {copy.nav.latest}
            </Link>
            <Link href="/history" className="hover:text-foreground">
              {copy.nav.history}
            </Link>
            <Link href="/settings" className="hover:text-foreground">
              {copy.nav.settings}
            </Link>
          </nav>
        </div>
        <div className="sm:min-w-[220px]">
          <WakeButton />
        </div>
      </div>
    </header>
  );
}
