# 🐓 RoosterAI

Why check four apps when one bird do trick.

RoosterAI is a self-hosted morning briefing agent that wakes up before you do, pecks through your analytics and mailboxes, and crows a clean, AI-summarized digest straight to your phone.

No multi-tenant SaaS. No tracking. No subscription fees. Just a loud bird doing the chores while you sleep.

```
┌────────────────────────────────────────────┐
│   apps checked manually     4 tabs, 45 min │
│   apps checked by rooster   1 msg, 30 sec  │
│   coffee temperature        hot            │
│   vibes                     EARLY BIRD     │
└────────────────────────────────────────────┘
```

## Tier 0 — hatch a demo brief (no keys)

```bash
git clone https://github.com/royboy1990/-RoosterAI
cd RoosterAI
npm install
npm run wake -- --demo
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see a labeled `[DEMO]` brief — canned farm data, stub LLM, file delivery. Same pipeline as a real run; zero network, zero secrets.

Primary action everywhere: **Wake the Flock Up** (`npm run wake`).

## Onboarding ladder

| Tier | What you add | Command |
|------|----------------|---------|
| **0** | Nothing | `npm run wake -- --demo` |
| **1** | IMAP + one LLM key | copy `.env` + config, then `npm run wake` |
| **2** | Telegram | brief hits your phone |
| **3** | GA4, more mailboxes, your connectors | see docs below |

### Tier 1 — one source + one LLM key

IMAP leads on purpose: an app password takes about two minutes. GA4 needs a GCP project, service account, JSON key, and property access — so it waits until Tier 3.

```bash
cp .env.example .env
cp rooster.config.example.json rooster.config.json
# edit .env: IMAP_* + OPENAI_API_KEY
# edit rooster.config.json: timezone, model, enabled connectors
npm run wake
```

### Tier 2 — delivery

Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, set `"delivery": { "channel": "telegram" }` in config.

### Tier 3 — everything else

GA4 (`GA4_PROPERTY_ID` + `GOOGLE_APPLICATION_CREDENTIALS`), Anthropic, custom connectors — see [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/CUSTOM-CONNECTORS.md](./docs/CUSTOM-CONNECTORS.md).

## How it works

```
[Cron / dashboard / curl]
       │
       ▼
   src/core/run.ts  ──> connectors (GA4, IMAP, yours)
       │
       ▼
   sanitize + LLM  ──> terse executive brief
       │
       ▼
   Telegram / file ──> data/briefs/<timestamp>.json + phone
```

Core lives in `src/core/**` as pure TypeScript (no Next.js imports), so crontab can run `npm run wake` with no server. The dashboard imports the same code.

Core does **not** scrape the web or drive a headless browser. Those stay in your fork — see [docs/CUSTOM-CONNECTORS.md](./docs/CUSTOM-CONNECTORS.md).

## Scheduling

See [docs/SCHEDULING.md](./docs/SCHEDULING.md) for crontab, GitHub Actions, and the token-protected `POST /api/run` HTTP trigger.

## Config vs secrets

- **Secrets** → `.env` only (gitignored). Dashboard shows set/missing, never values, never accepts secret inputs.
- **Preferences** → `rooster.config.json` (gitignored; copy from `rooster.config.example.json`). Connectors on/off, model, delivery, timezone, schedule hint.

## License

MIT — see [LICENSE](./LICENSE).
