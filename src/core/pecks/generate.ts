import { copy } from "../../copy";
import type { LoadedConfig } from "../config";
import { SHOWCASE_PECKS } from "../demo/showcase-brief";
import { getLlmProvider, stubProvider } from "../llm";
import type { RunContext } from "../types";

const PECKS_SYSTEM = `You propose short follow-up questions ("Pecks") an operator should investigate or decide next about this morning brief.

Rules:
- Return 0–3 questions. Never pad to reach a count. Prefer one strong question over three filler ones.
- Prefer synthesis, comparison, anomaly investigation, or decision support.
- A strong Peck connects multiple facts, sources, or periods — not a single table cell.
- Do not ask simple lookup questions whose answers are already prominent in the brief (counts already listed, top pages already named, etc.).
- Questions must still be answerable from the provided brief text and digest — not speculative beyond that evidence.
- Factual, calm wording. No invented drama. No personality flourishes.
- Order strongest / most useful first.
- Each question on its own line. No numbering, bullets, or quotes.
- If nothing worth asking, reply with exactly: NONE`;

function parsePecksLines(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || /^none$/i.test(trimmed)) {
    return [];
  }

  const lines = trimmed
    .split("\n")
    .map((line) =>
      line
        .replace(/^[\s>*-]+/, "")
        .replace(/^\d+[.)]\s*/, "")
        .replace(/^["']|["']$/g, "")
        .trim(),
    )
    .filter((line) => line.length > 0 && !/^none$/i.test(line));

  // Dedupe while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(line);
    if (unique.length >= 3) {
      break;
    }
  }
  return unique;
}

/**
 * Fail-soft pecks generation from brief text + digest.
 * Returns pecks array and optional error; never throws for LLM failures.
 */
export async function generatePecks(input: {
  loaded: LoadedConfig;
  text: string;
  digest: string;
  runSignal: AbortSignal;
  ctx: RunContext;
}): Promise<{ pecks: string[]; pecksError?: string }> {
  const { loaded, text, digest, runSignal, ctx } = input;
  const { config } = loaded;

  if (!config.pecksEnabled) {
    return { pecks: [] };
  }

  const llm = getLlmProvider(config.llm.provider);
  if (!llm) {
    return { pecks: [], pecksError: `Unknown LLM provider "${config.llm.provider}"` };
  }

  // Demo / stub: canned showcase pecks — no network.
  if (config.demo || llm.id === stubProvider.id) {
    return { pecks: [...SHOWCASE_PECKS] };
  }

  const missing = llm.requiredEnv.filter((name) => {
    const value = loaded.env[name];
    return value === undefined || value.trim() === "";
  });
  if (missing.length > 0) {
    return {
      pecks: [],
      pecksError: `missing env: ${missing.join(", ")}`,
    };
  }

  const user = [
    "## Brief text",
    text.replace(new RegExp(`^${copy.demoMarker}\\n?`), "").trim(),
    "",
    "## Digest",
    digest.trim() || "(empty)",
  ].join("\n");

  const pecksCtx: RunContext = {
    ...ctx,
    signal: AbortSignal.any([
      runSignal,
      AbortSignal.timeout(config.pecksTimeoutMs),
    ]),
  };

  try {
    const completion = await llm.complete(
      {
        system: PECKS_SYSTEM,
        user,
        model: config.llm.model,
      },
      pecksCtx,
    );
    return { pecks: parsePecksLines(completion.text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { pecks: [], pecksError: message };
  }
}
