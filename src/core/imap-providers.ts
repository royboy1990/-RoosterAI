/**
 * Well-known IMAP hosts → friendly Keys / UI labels.
 * Exact host match (case-insensitive). Unknown hosts fall back to "Email".
 */
const IMAP_PROVIDER_LABELS: Readonly<Record<string, string>> = {
  "imap.gmail.com": "Gmail",
  "imap.googlemail.com": "Gmail",
  "mail.privateemail.com": "Private Email",
  "imap.privateemail.com": "Private Email",
  "outlook.office365.com": "Outlook",
  "imap-mail.outlook.com": "Outlook",
  "imap.office365.com": "Outlook",
  "imap.mail.yahoo.com": "Yahoo Mail",
  "imap.aol.com": "AOL",
  "imap.mail.me.com": "iCloud Mail",
  "imap.zoho.com": "Zoho Mail",
  "imappro.zoho.com": "Zoho Mail",
  "imap.fastmail.com": "Fastmail",
  "imap.protonmail.ch": "Proton Mail",
  "127.0.0.1": "Email",
  "imap.yandex.com": "Yandex Mail",
  "imap.mail.ru": "Mail.ru",
  "imap.gmx.com": "GMX",
  "imap.gmx.net": "GMX",
  "imap.mail.com": "Mail.com",
  "imap.secureserver.net": "GoDaddy",
  "imap.ionos.com": "IONOS",
  "imap.titan.email": "Titan Email",
  "imap.dreamhost.com": "DreamHost",
  "mail.hover.com": "Hover",
  "imap.migadu.com": "Migadu",
  "imap.purelymail.com": "Purelymail",
  "mail.messagingengine.com": "Fastmail",
};

const FALLBACK_LABEL = "Email";

/** Friendly label for an IMAP host, or "Email" when unknown / unset. */
export function labelForImapHost(host: string | undefined): string {
  const normalized = host?.trim().toLowerCase();
  if (!normalized) {
    return FALLBACK_LABEL;
  }
  return IMAP_PROVIDER_LABELS[normalized] ?? FALLBACK_LABEL;
}
