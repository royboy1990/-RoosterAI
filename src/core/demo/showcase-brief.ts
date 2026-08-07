/**
 * Polished sample brief for --demo / marketing screenshots.
 * Uses the dashboard formatting catalog (###, !!!, tables, bullets).
 */

/** Final brief body (pipeline still prefixes [DEMO] when config.demo). */
export const SHOWCASE_BRIEF_TEXT = `### Attention Today

!!! Reply to **Alex at Northwind** — Q3 proposal waiting on your edits before Friday standup
!!! **Ship connector docs** is 2 days overdue — blocks the public README examples

---

### Analytics · yesterday

| Property | Sessions | Δ |
| --- | --- | --- |
| GameFoundry | 842 | ↑18% |
| Baseplate Digital | 311 | ↑6% |
| Docs | 131 | ↓4% |

**Top landing:** \`/pricing\` (318 sessions). Bounce **41%** (flat vs prior day).

---

### Calendar

- **10:00** Standup — eng (30m)
- **11:30** Northwind proposal review with Alex
- **15:00** Renew domain — reminder (roosterai.dev)
- Evening clear after 16:00

---

### Inbox

- **alex@northwind.co** — Re: Q3 proposal — needs reply today
- **billing@host** — Invoice #4412 due Friday ($48)
- noreply@saas — Weekly digest (noise)

---

### GitHub

- **3** review requests on \`royboy1990/-RoosterAI\`
- **1** failing check on \`feature/spoken-brief\` (lint)
- Notifications quiet otherwise

---

### Do Today

1. Reply to Alex with the revised proposal deck
2. Unblock **Ship connector docs** (or renotify owner)
3. Glance at GameFoundry traffic spike — campaign or bot?
4. Pay Invoice #4412 before Friday
`;

/** Digest lines shown in connector outcomes for the Demo Farm source. */
export const SHOWCASE_DEMO_LINES: string[] = [
  "Sessions yesterday: 1,284 (↑12% vs prior day) across GameFoundry, Baseplate, Docs",
  "Top landing page: /pricing (318 sessions); bounce 41%",
  "Calendar: Standup 10:00, Northwind review 11:30, domain renew reminder 15:00",
  "Unread mail: 3 — alex@northwind.co (Q3 proposal), billing@host (#4412), saas digest",
  "GitHub: 3 review requests; 1 failing check on feature/spoken-brief",
  "Open tasks: 2 overdue (Ship connector docs, Renew domain)",
];
