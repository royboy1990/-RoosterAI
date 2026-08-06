# Scheduling RoosterAI

Three ways to crow every morning. Pick one. Timezone in `rooster.config.json` must agree with cron hour and GA4 "yesterday".

## 1. Crontab (simplest)

No Next.js server required — core is plain TypeScript.

```cron
0 7 * * * cd /path/to/RoosterAI && /usr/bin/npm run wake >> data/rooster.log 2>&1
```

Use an absolute `npm` path if cron's `PATH` is thin. Demo-only cron is rarely useful; point at a real `rooster.config.json` + `.env`.

## 2. GitHub Actions

Starter workflow: [`.github/workflows/wake.yml`](../.github/workflows/wake.yml).

1. Fill `.env` locally as usual.
2. Generate env mappings from what you actually set (unset keys are omitted):

```bash
npm run generate:wake-workflow
```

3. Add the printed secret names under repo **Settings → Secrets and variables → Actions**.
4. Commit `.github/workflows/wake.yml` (and optionally a non-secret `rooster.config.json`, or set `ROOSTER_CONFIG_JSON`).
5. **Actions → Wake the Flock Up → Run workflow**, or wait for the schedule (UTC — edit the cron).

`ROOSTER_RUN_TOKEN` is not used here — Actions runs `npm run wake` directly.

**GitHub connector gotcha:** store the PAT as secret `ROOSTER_GITHUB_TOKEN` (not `GITHUB_TOKEN`); the generator maps it to `GITHUB_TOKEN` in the job env.

**GA4:** when `GOOGLE_APPLICATION_CREDENTIALS` is set locally, the generator adds a step that writes `ga4-service-account.json` from secret `GA4_SERVICE_ACCOUNT_JSON` (paste the full JSON file contents).

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
