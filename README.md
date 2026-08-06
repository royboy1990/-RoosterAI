# 🐓 RoosterAI

Why check four apps when one bird do trick.

RoosterAI is a self-hosted morning briefing agent that wakes up before you do, pecks through your sources, and crows a clean, AI-summarized digest straight to your phone.

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

Open [http://localhost:3000](http://localhost:3000). First run lands on **Stock the Coop** (`/coop`) — pick sources, or hit **Just show me the demo**. You should see a labeled `[DEMO]` brief — canned data, stub LLM, file delivery. Same pipeline as a real run; zero network, zero secrets.

Primary action everywhere: **Wake the Flock Up** (`npm run wake`).

## Onboarding ladder

| Tier | What you add | Command |
|------|----------------|---------|
| **0** | Nothing | `npm run wake -- --demo` |
| **1** | GitHub + Calendar + one LLM key | copy `.env` + config, then `npm run wake` |
| **2** | Telegram | brief hits your phone |
| **3** | IMAP, GA4, your connectors | stock more from `/coop` |

### Tier 1 — GitHub + Calendar + one LLM key

GitHub is the lowest-friction real source for this audience (you already have an account). Calendar needs only a secret ICS URL — no API key. GA4 stays in the catalog as the advanced service-account example; install it from `/coop` only if you want it.

```bash
cp .env.example .env
cp rooster.config.example.json rooster.config.json
# edit .env: GITHUB_TOKEN + CALENDAR_ICS_URL + OPENAI_API_KEY
# edit rooster.config.json: timezone, model (connectors are already sparse)
npm run wake
```

Or skip the file copy: open `/coop`, install what you want, then drop keys in `.env`.

### Tier 2 — delivery

Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, set `"delivery": { "channel": "telegram" }` in config.

### Tier 3 — everything else

IMAP, GA4 (`GA4_PROPERTY_ID` + `GOOGLE_APPLICATION_CREDENTIALS`), Anthropic, custom connectors — stock from `/coop`, then see [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/CUSTOM-CONNECTORS.md](./docs/CUSTOM-CONNECTORS.md).

## How it works

```
[Cron / dashboard / curl]
       │
       ▼
   src/core/run.ts  ──> connectors (GitHub, Calendar, IMAP, GA4, yours)
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

- **Secrets** → `.env` only (gitignored). Dashboard shows set/missing for **installed** sources, never values, never accepts secret inputs.
- **Preferences** → `rooster.config.json` (gitignored; copy from `rooster.config.example.json`, or let `/coop` create it). Sparse `connectors[]` — installed only. Model, delivery, timezone, schedule hint live on Settings.

## License

MIT — see [LICENSE](./LICENSE).
