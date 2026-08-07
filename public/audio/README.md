# Rooster FM audio

Two seed morning beds ship with the repo (~1.7 MB each). Everything else stays on **your machine**.

## Seed tracks (in git)

| File | Notes |
|------|--------|
| `A_Room_at_Daybreak.mp3` | AI-generated morning jazz bed |
| `Window_Seat_Sunrise.mp3` | AI-generated morning jazz bed |

Other `*.mp3` files in this folder are **gitignored**. Do not commit personal or copyrighted music.

## Adding your own tracks (recommended)

Use the **Rooster FM dock** in the dashboard:

1. Click **Add**, or drag and drop audio onto the dock.
2. Tracks are stored in **this browser’s IndexedDB** — not uploaded, not committed.
3. Remove a personal track with **Remove** while it is selected (deletes from this browser only).
4. **Remove** on a seed track only hides it from your player — the MP3 stays in the repo. Use **Restore seeds** to bring hidden seeds back.

Supported: MP3 and other common audio types, up to 25 MB each.

## Optional: static files for a private deploy

If you self-host and want files under `/audio/...` instead of the browser library:

1. Drop MP3s here (they stay local thanks to `.gitignore`).
2. Append entries in [`src/rooster-fm/playlist.ts`](../../src/rooster-fm/playlist.ts).

Still never commit copyrighted songs.
