import type { ReactNode } from "react";

/** Shared stroke icons for Settings section headers. */
export function SettingsKeysIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className ?? "size-4 shrink-0"}
    >
      <circle cx="5.5" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7.5 7.5 13.25 13.25M11 10.75l1.75 1.75M10.25 13.25 12 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsAudioIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className ?? "size-4 shrink-0"}
    >
      <path
        d="M2.5 6.25v3.5h2.5L8.5 13V3L5 6.25H2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10.25 6.1a2.75 2.75 0 0 1 0 3.8M11.9 4.35a5 5 0 0 1 0 7.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SettingsPreferencesIcon({
  className,
}: {
  className?: string;
}): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className ?? "size-4 shrink-0"}
    >
      <path
        d="M3 4.5h10M3 8h10M3 11.5h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="6" cy="4.5" r="1.35" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1.35" fill="currentColor" />
      <circle cx="7.5" cy="11.5" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function SettingsAnalyticsIcon({
  className,
}: {
  className?: string;
}): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className ?? "size-4 shrink-0"}
    >
      <path
        d="M3 12.5V8.25M7 12.5V3.5M11 12.5V6.5M14 12.5H2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsSeoIcon({
  className,
}: {
  className?: string;
}): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className ?? "size-4 shrink-0"}
    >
      <circle cx="7" cy="7" r="3.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 10.25 13.25 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
