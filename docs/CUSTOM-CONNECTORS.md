# Custom connectors (including Playwright)

RoosterAI core ships GA4 and IMAP only. Scrapers, LinkedIn, Fiverr, and headless browsers stay **out of this repo** on purpose — liability and ToS risk live in your fork, not upstream.

You can still build them. The connector contract is small and stable.

## The contract

```ts
export interface ConnectorResult {
  heading: string; // section title the LLM sees
  lines: string[]; // plain text only — sanitize before return
}

export interface Connector<TConfig = unknown> {
  id: string;
  label: string;
  requiredEnv: readonly string[];
  configSchema: z.ZodType<TConfig>;
  fetch(config: TConfig, ctx: RunContext): Promise<ConnectorResult>;
}
```

Pipeline behavior you get for free:

- Missing `requiredEnv` → connector skipped (friendly "still in the coop" note), run continues
- Per-connector timeout via `ctx.signal` (`AbortSignal.timeout`)
- `Promise.allSettled` so one hang does not kill the brief
- Character budget in `sanitize.ts` after your `fetch` returns

## Three-step add (same as CONTRIBUTING)

1. Copy `src/core/connectors/demo.ts` → your file; implement `fetch`
2. One line in `src/core/connectors/index.ts`
3. Document env vars in `.env.example`

See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Playwright in a fork (sketch)

Install Playwright only in your fork. Keep browser launch inside `fetch`, respect `ctx.signal`, and return plain lines — never HTML dumps.

```ts
import { chromium } from "playwright";
import { z } from "zod";
import type { Connector, ConnectorResult, RunContext } from "../types";

const schema = z.object({
  url: z.string().url(),
});

export const myScrapeConnector: Connector<z.infer<typeof schema>> = {
  id: "my-scrape",
  label: "My Scrape",
  requiredEnv: [], // or cookies / proxy secrets
  configSchema: schema,
  async fetch(config, ctx): Promise<ConnectorResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      ctx.signal.addEventListener("abort", () => {
        void browser.close();
      });
      await page.goto(config.url, { waitUntil: "domcontentloaded" });
      const text = await page.locator("main").innerText();
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 40);
      return { heading: "My Scrape", lines };
    } finally {
      await browser.close();
    }
  },
};
```

**Do not open a PR that adds this to upstream core.** Keep scrapers private or in a clearly marked personal fork. Site terms of service are your problem.

## Tips

- Prefer official APIs over scraping when they exist
- Log with `ctx.log(...)` — lines land in `data/rooster.log`
- Empty results: return a single honest line (or rely on sanitize's empty handling) so the LLM does not invent filler
- Non-secret knobs (limits, mailbox names, URLs) go in `rooster.config.json` via `configSchema`; secrets stay in `.env`
