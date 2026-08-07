# Security Policy

## Supported versions

RoosterAI is pre-1.0. Security fixes land on the latest `main` only.

| Version | Supported |
| ------- | --------- |
| `main` / latest release | Yes |
| Older commits / forks | No |

## Reporting a vulnerability

**Do not open a public GitHub issue** for security reports.

Email **[levyroy1990@gmail.com](mailto:levyroy1990@gmail.com)** with:

- A short description of the issue
- Steps to reproduce (or a proof of concept)
- Affected commit / tag if you know it
- Impact (e.g. secret leak, remote code execution, auth bypass on `/api/run`)

Please **do not** include live API keys, `.env` contents, service-account JSON, or personal mailbox data in the report. Redact secrets and use placeholders.

You should hear back within a few days. If the report is valid, we’ll work on a fix and credit you if you want (unless you prefer to stay anonymous).

## Scope

In scope:

- Flaws in this repository’s code (core pipeline, dashboard, connectors, delivery, HTTP wake trigger)
- Secret handling that could leak credentials from the app itself
- Unsafe defaults that expose a self-hosted instance without clear documentation

Out of scope:

- Issues that only affect misconfigured forks or deployments
- Compromised third-party keys / accounts (OpenAI, Google, Telegram, your mail host, etc.)
- Social engineering or physical access to a machine running RoosterAI
- Denial of service against a local-only dashboard

## Hardening notes for operators

- Keep `.env`, `rooster.config.json`, `data/`, and `*ga4-service-account.json` out of git (see `.gitignore`)
- Set a long random `ROOSTER_RUN_TOKEN` before exposing `POST /api/run`
- Prefer binding the dashboard to localhost unless you intentionally put it behind auth / a reverse proxy
- Rotate any key that may have been committed or pasted into a chat/issue
