# Scheduling RoosterAI

Three ways to crow every morning. Pick one. Timezone in `rooster.config.json` must agree with cron hour and GA4 "yesterday".

## 1. Crontab (simplest)

No Next.js server required — core is plain TypeScript.

```cron
0 7 * * * cd /path/to/RoosterAI && /usr/bin/npm run wake >> data/rooster.log 2>&1
```

Use an absolute `npm` path if cron's `PATH` is thin. Demo-only cron is rarely useful; point at a real `rooster.config.json` + `.env`.

## 2. GitHub Actions

Schedule a workflow that checks out the repo, installs, and runs `npm run wake`. Store secrets in repo Settings → Secrets (IMAP, OpenAI, Telegram, etc.). Commit a non-secret `rooster.config.json` via the Actions checkout only if you're comfortable with it in the repo, or generate it in the workflow from a secret blob.

Example sketch:

```yaml
name: Wake the Flock Up
on:
  schedule:
    - cron: "0 0 * * *" # 00:00 UTC — adjust for your timezone
  workflow_dispatch:
jobs:
  wake:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run wake
        env:
          IMAP_HOST: ${{ secrets.IMAP_HOST }}
          IMAP_USER: ${{ secrets.IMAP_USER }}
          IMAP_PASS: ${{ secrets.IMAP_PASS }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
```

Persist `data/briefs/` across runs only if you need history (artifact upload or a remote store). For Telegram-only delivery, file history is optional.

## 3. HTTP trigger — `POST /api/run`

For a hosted Next.js process (`npm run build && npm run start`) or any reverse proxy in front of it.

1. Set a long random `ROOSTER_RUN_TOKEN` in `.env`. **If this var is unset, the route returns 503 and refuses to run** — it never defaults open.
2. Call:

```bash
curl -X POST https://your-host/api/run \
  -H "Authorization: Bearer $ROOSTER_RUN_TOKEN"
```

Success: `200` with `{ ok: true, briefId, status, … }`.  
Wrong/missing bearer: `401`.  
Token unset on server: `503`.

Use this from an external cron service, Uptime-style pinger, or another machine that should not hold your IMAP/LLM secrets — those stay on the host running Rooster.

## Dashboard button

`Wake the Flock Up` on localhost invokes the same pipeline via a Server Action. Fine for manual runs; use cron or `/api/run` for unattended mornings.
