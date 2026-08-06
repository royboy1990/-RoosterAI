/**
 * All user-facing strings. Core and the dashboard import the same wording.
 * The brief payload itself stays terse and factual — personality lives here.
 */
export const copy = {
  brand: "RoosterAI",
  wakeAction: "Wake the Flock Up",
  pendingGather: "Pecking through the data...",
  pendingLlm: "Waking the flock...",
  emptyCoop:
    "The coop is empty. No briefs hatched yet. Drop your keys in `.env`, pick your sources, and hit Wake the Flock Up — or let cron handle the morning ritual.",
  emptyCoopHint: "Or hatch a labeled sample with `npm run wake -- --demo`.",
  stillInTheCoopHeading: "Still in the coop",
  skippedMissingEnv: (label: string) =>
    `${label} is still sleeping in today. (Skipped — missing credentials)`,
  skippedTimeout: (label: string) =>
    `${label} took too long and got left in the coop. (Timed out)`,
  skippedFailed: (label: string) =>
    `${label} is still sleeping in today. (Skipped)`,
  emptyConnectorResult: "Nothing new here.",
  demoMarker: "[DEMO]",
  demoBanner:
    "This brief was hatched in demo mode. Numbers and mail are canned — not your farm.",
  coopStatus: {
    label: "Coop Status",
    optimal: "Optimal",
    ruffled: "Ruffled",
    feathersEverywhere: "Feathers Everywhere",
    unknown: "Awaiting first crow",
  },
  nav: {
    latest: "Latest",
    history: "History",
    settings: "Settings",
  },
  latest: {
    title: "Latest brief",
    outcomesHeading: "Connector outcomes",
    errorDetailsSummary: "Show real error",
    llmFallback:
      "The LLM call failed — you got the raw sanitized digest instead.",
  },
  history: {
    title: "History",
    empty: "No briefs in the archive yet.",
    demoTag: "DEMO",
  },
  settings: {
    title: "Settings",
    keysHeading: "Keys",
    keysBlurb:
      "Secrets live in `.env` — this panel only shows set / missing. Nothing here accepts a secret.",
    keysSet: "set",
    keysMissing: "missing",
    keysDocHint: "See `.env.example` for the tiered setup ladder.",
    preferencesHeading: "Preferences",
    preferencesBlurb:
      "Toggles, model, delivery, and timezone. Saved to `rooster.config.json`.",
    timezone: "Timezone",
    scheduleHint: "Schedule hint (cron)",
    llmProvider: "LLM provider",
    llmModel: "Model",
    deliveryChannel: "Delivery",
    connectorsHeading: "Connectors",
    save: "Save preferences",
    saved: "Preferences roosted.",
    saveFailed: "Could not save preferences.",
  },
  wake: {
    success: "Flock woken. Fresh brief on the perch.",
    failed: "Wake failed.",
  },
  /** System prompt for the briefing LLM — factual, not rooster-voiced. */
  briefSystemPrompt: `You are a morning briefing assistant. Produce a terse, scannable executive summary from the provided data sections.

Rules:
- Lead with what needs attention today.
- Prefer metric deltas, who needs a reply, and what is overdue.
- Use short paragraphs or bullets. No filler, no jokes, no personality flourishes.
- If a section says there is nothing new, say so in one line — do not invent numbers or messages.
- Do not mention being an AI.`,
} as const;

export type Copy = typeof copy;
