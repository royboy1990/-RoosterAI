import { formatUsdEstimate } from "@/app/_lib/format";
import { SettingsAnalyticsIcon } from "@/app/_components/settings-section-icons";
import { SettingsSectionFold } from "@/app/_components/settings-section-fold";
import { copy } from "@/src/copy";
import type { BriefSpendSummary } from "@/src/core/pricing/rollup";

function spendAmount(usd: number | null): string {
  if (usd === null) {
    return "—";
  }
  return formatUsdEstimate(usd);
}

/**
 * Read-only Settings fold: calendar week / month spend from frozen brief.usage.
 */
export function EstimatedSpendSection({
  summary,
}: {
  summary: BriefSpendSummary;
}) {
  const weekLabel = spendAmount(summary.weekUsd);
  const monthLabel = spendAmount(summary.monthUsd);
  const summaryLine = `${copy.settings.spendWeekShort} ${weekLabel} · ${copy.settings.spendMonthShort} ${monthLabel}`;

  return (
    <SettingsSectionFold
      title={copy.settings.spendHeading}
      icon={<SettingsAnalyticsIcon />}
      summary={summaryLine}
      defaultOpen={false}
      className="border-accent/25 bg-surface-raised/80"
    >
      <p className="text-sm text-muted">{copy.settings.spendBlurb}</p>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-muted">{copy.settings.spendThisWeek}</dt>
          <dd className="metric-mono text-lg text-foreground">{weekLabel}</dd>
          <dd className="metric-mono text-xs text-muted">
            {copy.settings.spendBriefCount(summary.weekBriefs)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-muted">{copy.settings.spendThisMonth}</dt>
          <dd className="metric-mono text-lg text-foreground">{monthLabel}</dd>
          <dd className="metric-mono text-xs text-muted">
            {copy.settings.spendBriefCount(summary.monthBriefs)}
          </dd>
        </div>
      </dl>

      {summary.hasUnknown ? (
        <p className="text-sm text-muted">{copy.settings.spendIncomplete}</p>
      ) : null}
    </SettingsSectionFold>
  );
}
