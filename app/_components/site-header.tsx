import Link from "next/link";
import { copy } from "@/src/copy";
import type { CoopStatus } from "@/src/core/types";
import {
  coopStatusClass,
  coopStatusLabel,
  formatHeaderTime,
} from "@/app/_lib/format";
import { WakeButton } from "@/app/_components/wake-provider";

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
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-accent"
            >
              {/* Black plate on the PNG; screen blend lifts the bird on dark chrome. */}
              <img
                src="/rooster-mark.png"
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 object-contain mix-blend-screen"
                aria-hidden
              />
              <span>{copy.brand}</span>
            </Link>
            <p className="metric-mono min-w-0 text-xs text-muted">
              [{time}] · {copy.coopStatus.label}:{" "}
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${coopStatusClass(status)}`}
              >
                {coopStatusLabel(status)}
              </span>
            </p>
          </div>
          <nav className="flex min-w-0 flex-wrap gap-4 text-sm text-muted">
            <Link href="/" className="hover:text-foreground">
              {copy.nav.latest}
            </Link>
            <Link href="/history" className="hover:text-foreground">
              {copy.nav.history}
            </Link>
            <Link href="/coop" className="hover:text-foreground">
              {copy.nav.coop}
            </Link>
            <Link href="/settings" className="hover:text-foreground">
              {copy.nav.settings}
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2 self-start sm:self-center">
          <WakeButton />
        </div>
      </div>
    </header>
  );
}
