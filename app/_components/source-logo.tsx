import type { ReactElement, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconShell({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function Ga4Logo(props: IconProps) {
  return (
    <IconShell {...props}>
      <path d="M4.5 18.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Z" />
      <path d="M10.25 18.75V9.5a1.75 1.75 0 0 1 3.5 0v9.25a1.75 1.75 0 1 1-3.5 0Z" />
      <path d="M16.5 18.75V4.75a1.75 1.75 0 0 1 3.5 0v14a1.75 1.75 0 1 1-3.5 0Z" />
    </IconShell>
  );
}

function OpenAiLogo(props: IconProps) {
  return (
    <IconShell {...props}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872Zm16.597 3.855-5.844-3.369L15.113 7.21a.076.076 0 0 1 .071 0l4.83 2.787a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.391-.673Zm2.01-3.023-.141-.085-4.777-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66Zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z" />
    </IconShell>
  );
}

function GeminiLogo(props: IconProps) {
  return (
    <IconShell {...props}>
      <path d="M12 2c.4 4.4 2.6 6.6 7 7-4.4.4-6.6 2.6-7 7-.4-4.4-2.6-6.6-7-7 4.4-.4 6.6-2.6 7-7Z" />
      <path d="M19.2 14.4c.18 1.95 1.17 2.94 3.12 3.12-1.95.18-2.94 1.17-3.12 3.12-.18-1.95-1.17-2.94-3.12-3.12 1.95-.18 2.94-1.17 3.12-3.12Z" />
    </IconShell>
  );
}

function AnthropicLogo(props: IconProps) {
  return (
    <IconShell {...props}>
      <path d="M13.827 3.52h3.603L22 20.48h-3.414l-.922-3.004h-5.328l-.923 3.004H7.999L13.827 3.52Zm.866 4.1-1.9 6.197h3.8l-1.9-6.197ZM5.348 3.52h3.262l-5.14 16.96H.001L5.348 3.52Z" />
    </IconShell>
  );
}

function TelegramLogo(props: IconProps) {
  return (
    <IconShell {...props}>
      <path d="M21.943 4.357 2.913 11.51c-1.3.504-1.292 1.205-.236 1.522l4.878 1.523 1.845 5.638c.223.616.114.86.775.86.509 0 .734-.232 1.014-.508l2.437-2.365 5.064 3.738c.932.514 1.603.248 1.832-.864l3.314-15.61c.34-1.357-.52-1.97-1.893-1.487Zm-3.05 2.71-9.78 8.85-.39 4.063-.79-4.83 10.96-8.083Z" />
    </IconShell>
  );
}

function GithubLogo(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </IconShell>
  );
}

function CalendarLogo(props: IconProps) {
  return (
    <IconShell fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </IconShell>
  );
}

function ImapLogo(props: IconProps) {
  return (
    <IconShell fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m4 7.5 8 6.5 8-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconShell>
  );
}

function FileLogo(props: IconProps) {
  return (
    <IconShell fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V9h5.5" strokeLinejoin="round" />
    </IconShell>
  );
}

function DemoLogo(props: IconProps) {
  return (
    <IconShell fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.5 12.5 11 14l3.5-4" strokeLinecap="round" strokeLinejoin="round" />
    </IconShell>
  );
}

function StubLogo(props: IconProps) {
  return (
    <IconShell fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        d="M8 7h8M8 12h5M8 17h7"
        strokeLinecap="round"
      />
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    </IconShell>
  );
}

function RoosterLogo(props: IconProps) {
  return (
    <IconShell {...props}>
      <path d="M13.2 3.2c.4 1.4 1.2 2.2 2.6 2.6-.8.2-1.4.6-1.8 1.2 1.8.1 3.2.9 4.2 2.3.5.7.7 1.5.6 2.4-.2 1.6-1.2 2.8-2.8 3.5l.8 5.6c.1.6-.4 1.2-1 1.2h-4.4c-.6 0-1.1-.5-1-1.1l.5-3.2c-2.3-.2-4.1-1.4-5.1-3.4-.4-.8-.5-1.6-.3-2.4.5-1.9 2-3.1 4.1-3.5.1-.9.5-1.6 1.1-2.1-.8-.5-1.3-1.3-1.4-2.4 1.5.3 2.5 1 3.1 2.1.2-.8.6-1.5 1.2-2.2Z" />
    </IconShell>
  );
}

const LOGOS: Record<string, (props: IconProps) => ReactElement> = {
  ga4: Ga4Logo,
  "openai-compatible": OpenAiLogo,
  gemini: GeminiLogo,
  anthropic: AnthropicLogo,
  telegram: TelegramLogo,
  github: GithubLogo,
  calendar: CalendarLogo,
  imap: ImapLogo,
  file: FileLogo,
  demo: DemoLogo,
  stub: StubLogo,
  rooster: RoosterLogo,
};

export function SourceLogo({
  sourceId,
  className,
}: {
  sourceId: string;
  className?: string;
}) {
  const Logo = LOGOS[sourceId] ?? StubLogo;
  return <Logo className={className ?? "size-4"} />;
}
