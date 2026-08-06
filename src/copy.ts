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
    "The coop is empty. No briefs hatched yet. Stock sources in the Coop, drop your keys in `.env`, and hit Wake the Flock Up — or let cron handle the morning ritual.",
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
    coop: "Coop",
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
  coop: {
    title: "Stock the Coop",
    blurb:
      "Install the sources you want. Available connectors stay off the dashboard and Keys board until you add them.",
    firstRunHeading: "Welcome — pick your morning sources",
    firstRunBlurb:
      "Nothing is installed yet. Add GitHub, Calendar, or whatever you need. Keys stay in `.env`; this page only records intent.",
    firstRunDemo: "Just show me the demo",
    firstRunDemoHint:
      "Hatches a labeled sample brief with canned data — no keys, no config file.",
    firstRunAfterDemo:
      "That was a demo brief. Stock real sources below (or keep pecking the demo) so the dashboard stops bouncing you back here.",
    installedHeading: "Installed",
    installedEmpty: "Nothing installed yet — pick sources below.",
    availableHeading: "Available",
    searchPlaceholder: "Search by name, description, or tag…",
    noSearchMatches: "No available connectors match that search.",
    availableEmpty: "Every catalog connector is already installed.",
    install: "Install",
    remove: "Remove",
    mute: "Mute",
    unmute: "Unmute",
    missingKeys: "Missing keys",
    setupLink: "How to get these keys",
    willNeed: "Needs",
    unknownLabel: "Unknown connector",
    unknownBlurb:
      "Present in config but not in this build's catalog — kept so a branch switch does not wipe it.",
    state: {
      active: "Active",
      muted: "Muted",
      needsKeys: "Needs keys",
      available: "Available",
    },
    contribute:
      "Missing something? Write a connector or open an issue.",
    contributeDocs: "Custom connectors",
    contributeIssue: "Request a connector",
    installed: (label: string) => `${label} installed.`,
    removed: (label: string) => `${label} removed.`,
    muted: (label: string) => `${label} muted.`,
    unmuted: (label: string) => `${label} unmuted.`,
    alreadyInstalled: "Already installed.",
    alreadyRemoved: "Already removed.",
    installFailed: "Could not install connector.",
    removeFailed: "Could not remove connector.",
    muteFailed: "Could not update mute state.",
  },
  settings: {
    title: "Settings",
    keysHeading: "Keys",
    keysBlurb:
      "Secrets live in `.env` — this panel only shows set / missing for installed sources. Nothing here accepts a secret.",
    keysSet: "set",
    keysMissing: "missing",
    keysDocHint: "See `.env.example` for the tiered setup ladder.",
    keysEmpty:
      "No connector keys to show — install sources in the Coop first.",
    preferencesHeading: "Preferences",
    preferencesBlurb:
      "Model, delivery, and timezone. Sources are stocked in the Coop. Saved to `rooster.config.json`.",
    timezone: "Timezone",
    scheduleHint: "Schedule hint (cron)",
    llmProvider: "LLM provider",
    llmModel: "Model",
    deliveryChannel: "Delivery",
    connectorsHeading: "Connectors",
    connectorsManagedInCoop: "Stock and mute sources in the Coop.",
    openCoop: "Open the Coop",
    save: "Save preferences",
    saved: "Preferences roosted.",
    saveFailed: "Could not save preferences.",
  },
  wake: {
    success: "Flock woken. Fresh brief on the perch.",
    failed: "Wake failed.",
  },
  emptyCoopPipeline: "The coop is empty — no installed sources to gather.",
  skippedLlmEmpty: "LLM skipped — nothing to summarize.",
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
