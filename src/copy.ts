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
  defaultsBanner: {
    message:
      "Running on auto-detected defaults — nothing saved yet.",
    setupLink: "Review setup",
    dismiss: "Dismiss",
  },
  setup: {
    title: "Setup",
    blurb:
      "Confirm what `.env` already unlocks, pick sources, and save when you are ready. Skipping is fine — defaults already work.",
    keysHeading: "Detected keys",
    keysBlurb:
      "Read-only status from `.env`. Paste secrets there — this page never accepts them.",
    keysSet: "set",
    keysMissing: "missing",
    sourcesHeading: "Sources",
    sourcesBlurb:
      "Prefilled from auto-detection. Confirm or change, then save.",
    modelHeading: "Model and delivery",
    llmProvider: "LLM provider",
    llmModel: "Model",
    llmDefaultsHint: "Defaults by provider",
    deliveryChannel: "Delivery",
    save: "Save and start",
    skip: "Skip for now",
    saved: "Setup roosted.",
    saveFailed: "Could not save setup.",
  },
  latest: {
    title: "Latest brief",
    outcomesHeading: "Connector outcomes",
    errorDetailsSummary: "Show real error",
    llmFallback:
      "The LLM call failed — you got the raw sanitized digest instead.",
    /** Muted line when Latest is an unchanged pointer; body below is the prior brief. */
    unchangedNotice: (when: string) =>
      `Nothing new since ${when}. Showing the last brief below.`,
    playBrief: "Play spoken brief",
    pauseBrief: "Pause spoken brief",
    generateBrief: "Generate spoken brief",
    generatingBrief: "Generating spoken brief…",
    briefAudioFailed: "Could not generate spoken brief.",
    briefAudioReady: "Spoken brief ready.",
  },
  history: {
    title: "History",
    empty: "No briefs in the archive yet.",
    demoTag: "DEMO",
    unchangedTag: "UNCHANGED",
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
    keysOptional: "optional",
    keysInUse: "in use",
    keysGroupReady: "ready",
    keysGroupNeedsKeys: "needs keys",
    keysGroupStub: "stub",
    keysGroupUnused: "unused",
    keysLlmHeading: "LLM",
    keysLlmBlurb: "Any one provider is enough — missing alternatives are fine.",
    keysOtherHeading: "Other",
    keysOtherBlurb: "HTTP /api/run trigger",
    keysDocHint: "See `.env.example` for the tiered setup ladder.",
    keysEmpty:
      "No connector keys to show — install sources in the Coop first.",
    keysFoldEmpty: "Nothing installed",
    keysFoldReady: (n: number) =>
      n === 1 ? "1 source ready" : `${n} sources ready`,
    keysFoldAttention: (n: number) =>
      n === 1 ? "1 needs attention" : `${n} need attention`,
    preferencesHeading: "Preferences",
    preferencesBlurb:
      "Model, delivery, timezone, and briefing prompts. Sources are stocked in the Coop. Saved to `rooster.config.json`.",
    audioHeading: "Audio",
    audioBlurb:
      "Wake crow, spoken brief, and Rooster FM defaults. Personal tracks stay in the dock.",
    audioSaved: "Audio preference roosted.",
    audioSaveFailed: "Could not save audio preference.",
    audioFoldSummary: (opts: {
      crow: boolean;
      spoken: boolean;
      mode: "each-wake" | "on-demand";
      voice: string;
    }) => {
      const crow = opts.crow ? "Crow on" : "Crow off";
      if (!opts.spoken) {
        return `${crow} · Spoken off`;
      }
      const mode = opts.mode === "each-wake" ? "Each wake" : "On demand";
      return `${crow} · ${mode} · ${opts.voice}`;
    },
    timezone: "Timezone",
    timezoneHint:
      "IANA zone used for the clock, calendar “today”, and GA4 day boundaries. Leave as UTC and the dashboard will pick up your browser zone once.",
    timezoneUseBrowser: "Use browser timezone",
    operatorName: "Your name",
    operatorNameHint:
      "Optional. Used only in the spoken greeting (Good morning, Roy.) — not in the written brief.",
    scheduleHint: "Schedule hint (cron)",
    llmProvider: "LLM provider",
    llmModel: "Model",
    llmDefaultsHint: "Defaults by provider",
    deliveryChannel: "Delivery",
    wakeSound: "Wake crow",
    wakeSoundHint:
      "Play the crow when Wake the Flock Up finishes successfully.",
    ttsEnabled: "Spoken brief",
    ttsEnabledHint:
      "Generate an MP3 of the morning brief for playback on this dashboard.",
    ttsMode: "When to generate",
    ttsModeEachWake: "Each wake",
    ttsModeOnDemand: "On demand",
    ttsModeHint:
      "Each wake synthesizes after a successful run. On demand waits until you hit play on Latest.",
    ttsVoice: "Voice",
    ttsVoiceHint:
      "OpenAI built-in voices for gpt-4o-mini-tts. Use the play icon to preview.",
    ttsVoicePreviewPlay: "Preview voice",
    ttsVoicePreviewStop: "Stop preview",
    ttsVoicePreviewPlayNamed: (voice: string) => `Preview ${voice} voice`,
    ttsVoicePreviewStopNamed: (voice: string) => `Stop ${voice} preview`,
    ttsVoicePreviewFailed: "Voice preview failed.",
    ttsDisclosure:
      "Spoken briefs use OpenAI’s text-to-speech. Audio stays on this machine under data/audio/.",
    startMusicOnLoad: "Start Rooster FM when the app loads",
    startMusicOnLoadHint:
      "Starts after you open the app. Most browsers need one click anywhere first.",
    libraryDockHint:
      "Add, drop, or remove tracks from the Rooster FM dock.",
    connectorsHeading: "Connectors",
    connectorsManagedInCoop: "Stock and mute sources in the Coop.",
    openCoop: "Open the Coop",
    promptsHeading: "Briefing prompts",
    promptsBlurb:
      "Tune how the morning overview is written. Overview guidance is prepended to the gathered data; the system prompt sets the model’s role and style.",
    systemPrompt: "System prompt",
    systemPromptHint:
      "How the model should behave. Use Reset for the built-in default; clearing the field and saving also falls back to that default on the next run.",
    overviewPrompt: "Overview guidance",
    overviewPromptHint:
      "What you actually want in the brief — priorities, tone, sections to emphasize or skip. Can be long; soft-capped so it stays usable.",
    promptChars: (used: number, max: number) => `${used.toLocaleString()} / ${max.toLocaleString()}`,
    promptHistory: "Previous versions",
    promptHistoryEmpty: "No previous versions yet — they appear after you save a change.",
    promptHistoryLoad: "Load into editor",
    promptHistoryReset: "Reset system prompt to default",
    save: "Save preferences",
    unsavedChanges: "Unsaved changes",
    saved: "Preferences roosted.",
    saveFailed: "Could not save preferences.",
  },
  wake: {
    /** Plain string for CLI / API responses. */
    success: "Flock woken. Fresh brief on the perch.",
    /** Banner composes before + linked "perch" + after. */
    successBefore: "Flock woken. Fresh brief on the ",
    successLink: "perch",
    successAfter: ".",
    failed: "Wake failed.",
  },
  roosterFm: {
    label: "Rooster FM",
    idleTrack: "Morning bed",
    play: "Play",
    pause: "Pause",
    next: "Next track",
    prev: "Previous track",
    volume: "Volume",
    visualsOn: "Visuals on",
    visualsOff: "Visuals off",
    playGlyph: "▶",
    pauseGlyph: "❚❚",
    addTracks: "Add",
    removeTrack: "Remove",
    restoreSeed: "Restore seeds",
    dropHint: "Drop audio to add…",
    libraryHint:
      "Personal tracks stay in this browser only. Remove hides a seed from your player (file stays in the project).",
  },
  ga4: {
    heading: "Google Analytics properties",
    blurb:
      "Pulled from your service account. Select the sites you want in the morning brief.",
    credentialsMissing:
      "Set GOOGLE_APPLICATION_CREDENTIALS in `.env` to load your GA4 properties.",
    loadFailed: "Could not list GA4 properties.",
    loadFailedHint:
      "Enable the Google Analytics Admin API on the GCP project that owns this key, then refresh.",
    empty: "No GA4 properties visible to this service account.",
    foldReady: (n: number) =>
      n === 1 ? "1 property selected" : `${n} properties selected`,
    foldNeedsSetup: "Needs setup",
    accountLabel: "Account",
    selectAll: "Select all",
    selectNone: "Select none",
    selectedCount: (n: number) =>
      n === 1 ? "1 property selected" : `${n} properties selected`,
    save: "Save GA4 properties",
    saved: "GA4 properties roosted.",
    saveFailed: "Could not save GA4 properties.",
    refresh: "Refresh list",
  },
  emptyCoopPipeline: "The coop is empty — no installed sources to gather.",
  skippedLlmEmpty: "LLM skipped — nothing to summarize.",
  /** Delivered when today's digest matches the usable baseline. */
  wakeUnchanged: (when: string) =>
    `Nothing new since ${when}. Last brief still stands.`,
  wakeModeFull: "Wake mode: full (no usable baseline).",
  wakeModeDiff: (baselineId: string) =>
    `Wake mode: diff (vs ${baselineId}).`,
  wakeModeUnchanged: (baselineId: string) =>
    `Wake mode: unchanged (vs ${baselineId}) — skipping LLM.`,
  /**
   * Appended to the system prompt in diff mode only.
   * Memory is continuity context; today's digest is authoritative.
   */
  briefMemoryRule:
    "The \"## Memory\" section is prior-run continuity only. Today's data sections win if anything conflicts. Do not invent items that appear only as removed.",
  /** System prompt for the briefing LLM — factual, not rooster-voiced. */
  briefSystemPrompt: `You are a morning briefing assistant. Produce a terse, scannable executive summary from the provided data sections.

Rules:
- Lead with what needs attention today.
- Prefer metric deltas, who needs a reply, and what is overdue.
- Use short paragraphs or bullets. No filler, no jokes, no personality flourishes.
- If a section says there is nothing new, say so in one line — do not invent numbers or messages.
- Do not mention being an AI.
- Do not invent HTML, CSS, or any markup outside the formatting catalog below.

Formatting catalog (dashboard renders these; use sparingly):
- ### Section / #### Subsection
- **bold** for key names, metrics, or short labels
- - bullets and 1. numbered lists
- --- horizontal rule between major sections when useful
- !!! one-line urgent callout — only for items that need action today. At most 1–2 per brief. Example: !!! Reply to baseplatedigital support ticket
- Markdown tables — only when comparing the same fields across rows (e.g. sites × sessions × delta). Prefer bullets otherwise. Example:
  | Site | Sessions | Δ |
  | --- | --- | --- |
  | GameFoundry | 45 | ↑114% |

Do not use every format in every brief. Default to headings + bullets; reach for !!! and tables only when they clearly help.`,
} as const;

export type Copy = typeof copy;
