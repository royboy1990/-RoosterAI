# Contributing to RoosterAI

Thanks for pecking around. Keep changes small, keep `src/core/**` free of Next.js imports, and put user-facing strings in `src/copy.ts`.

By participating, you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Add a connector in three steps

`src/core/connectors/demo.ts` is the reference implementation — copy it, don't invent a parallel template full of TODOs.

### 1. Copy the demo connector

```bash
cp src/core/connectors/demo.ts src/core/connectors/my-source.ts
```

Implement `fetch` against your API. Return plain-text `lines` (no HTML). Declare every secret you need in `requiredEnv` — missing env skips the connector instead of crashing the run.

```ts
export const mySourceConnector: Connector<MyConfig> = {
  id: "my-source",
  label: "My Source",
  requiredEnv: ["MY_SOURCE_API_KEY"],
  configSchema: myConfigSchema,
  async fetch(config, ctx) {
    // use ctx.signal for timeouts / cancellation
    return { heading: "My Source", lines: ["…"] };
  },
};
```

### 2. Register one line

In `src/core/connectors/index.ts`:

```ts
import { mySourceConnector } from "./my-source";

export const connectors: readonly Connector[] = [
  demoConnector,
  imapConnector,
  ga4Connector,
  mySourceConnector, // ← you
];
```

### 3. Document the env vars

Add the keys to `.env.example` under the right onboarding tier, and enable the connector in `rooster.config.example.json` (or your local `rooster.config.json`) with any non-secret config.

That's it. Pipeline discovery is registry-only — no special cases in `pipeline.ts`.

## Voice and design

- All chrome copy lives in `src/copy.ts`. Don't sprinkle rooster jokes through JSX or the LLM system prompt.
- The brief payload stays terse and factual (see `copy.briefSystemPrompt`).
- Failures: friendly headline + real error in a collapsed details / `data/rooster.log`.

## Playwright / scrapers

Not welcome in core. Document how to keep them in a fork in [docs/CUSTOM-CONNECTORS.md](./docs/CUSTOM-CONNECTORS.md) so liability stays with the fork, not this repo.

## PR checklist

- [ ] `src/core/**` still has zero Next.js imports
- [ ] New connector has `requiredEnv`, zod `configSchema`, and a registry line
- [ ] `.env.example` updated
- [ ] Demo path still works: `npm run wake -- --demo`
