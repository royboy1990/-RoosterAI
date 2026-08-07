/**
 * Scan the repo for known RoosterAI secret shapes that should never be committed.
 *
 * Usage: npm run check:secrets
 *
 * Fast enough for CI. Looks for token formats (GitHub PAT, OpenAI, Anthropic,
 * Gemini, Telegram bot, PEM private keys, Google Calendar private ICS URLs) —
 * not for empty `.env.example` placeholders.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".vercel",
  "node_modules",
  "coverage",
  "data",
  "out",
  "build",
  "dist",
]);

const SKIP_FILE_RE =
  /\.(?:png|jpe?g|gif|webp|ico|mp3|wav|woff2?|ttf|eot|zip|gz|tgz|lock|tsbuildinfo|map)$/i;

/** Paths relative to repo root that may contain example patterns. */
const ALLOW_PATHS = new Set([
  "scripts/check-secrets.ts",
  ".env.example",
]);

const MAX_FILE_BYTES = 1_000_000;

type Rule = {
  id: string;
  label: string;
  pattern: RegExp;
};

const RULES: Rule[] = [
  {
    id: "github-classic-pat",
    label: "GitHub classic PAT (ghp_)",
    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
  },
  {
    id: "github-fine-grained-pat",
    label: "GitHub fine-grained PAT (github_pat_)",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    id: "github-oauth",
    label: "GitHub OAuth/user token (gho_/ghu_/ghs_/ghr_)",
    pattern: /\bgh[ours]_[A-Za-z0-9]{36}\b/g,
  },
  {
    id: "openai-key",
    label: "OpenAI API key (sk- / sk-proj-)",
    // Require enough entropy after the prefix to avoid doc stubs like "sk-...".
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "anthropic-key",
    label: "Anthropic API key (sk-ant-)",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "google-api-key",
    label: "Google/Gemini API key (AIza…)",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    id: "telegram-bot-token",
    label: "Telegram bot token",
    pattern: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,
  },
  {
    id: "private-key-pem",
    label: "PEM private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    id: "google-calendar-private-ics",
    label: "Google Calendar private ICS URL",
    // Require a real-looking private token (not README stubs like private-...).
    pattern:
      /https:\/\/calendar\.google\.com\/calendar\/ical\/[^/\s"'`]+\/private-[A-Za-z0-9]{8,}\/basic\.ics/gi,
  },
];

type Finding = {
  file: string;
  line: number;
  rule: string;
  snippet: string;
};

function shouldSkipFile(relPath: string): boolean {
  if (ALLOW_PATHS.has(relPath.replaceAll("\\", "/"))) {
    return true;
  }
  if (SKIP_FILE_RE.test(relPath)) {
    return true;
  }
  // Local secrets / keys — ignored by git, but skip if present on disk.
  if (relPath === ".env" || /^\.env\./.test(relPath)) {
    return true;
  }
  if (relPath.endsWith("ga4-service-account.json")) {
    return true;
  }
  if (relPath === "rooster.config.json") {
    return true;
  }
  return false;
}

function listFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) {
      continue;
    }
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      listFiles(abs, out);
      continue;
    }
    if (!st.isFile()) {
      continue;
    }
    if (st.size > MAX_FILE_BYTES) {
      continue;
    }
    const rel = path.relative(rootDir, abs);
    if (shouldSkipFile(rel)) {
      continue;
    }
    out.push(abs);
  }
  return out;
}

function redactedSnippet(line: string, match: string): string {
  const trimmed = line.trim().slice(0, 160);
  if (match.length < 8) {
    return trimmed;
  }
  const safe =
    match.slice(0, 4) + "…" + match.slice(Math.max(4, match.length - 4));
  return trimmed.replaceAll(match, safe);
}

function scanFile(absPath: string): Finding[] {
  const rel = path.relative(rootDir, absPath).replaceAll("\\", "/");
  let text: string;
  try {
    text = readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  // Skip obvious binaries.
  if (text.includes("\u0000")) {
    return [];
  }

  const findings: Finding[] = [];
  const lines = text.split(/\r?\n/);

  for (const rule of RULES) {
    // Fresh lastIndex for global patterns.
    rule.pattern.lastIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(line)) !== null) {
        const value = match[0];
        // Anthropic keys also match the OpenAI `sk-` rule — keep Anthropic only.
        if (rule.id === "openai-key" && value.startsWith("sk-ant-")) {
          continue;
        }
        findings.push({
          file: rel,
          line: i + 1,
          rule: rule.label,
          snippet: redactedSnippet(line, value),
        });
      }
    }
  }

  return findings;
}

function main(): void {
  const files = listFiles(rootDir);
  const findings = files.flatMap(scanFile);

  if (findings.length === 0) {
    console.log(`check-secrets: ok (${files.length} files scanned)`);
    process.exit(0);
  }

  console.error(`check-secrets: found ${findings.length} possible secret(s):\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`);
    console.error(`    ${finding.rule}`);
    console.error(`    ${finding.snippet}\n`);
  }
  console.error(
    "Remove the secret, rotate it if it was real, and keep values in `.env` only.",
  );
  process.exit(1);
}

main();
