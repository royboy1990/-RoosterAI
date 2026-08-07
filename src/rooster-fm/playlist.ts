export interface RoosterFmTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  /** Personal browser library entry — never committed to the repo. */
  local?: boolean;
}

/**
 * Built-in Rooster FM playlist.
 * Two compressed seed beds ship in-repo; personal tracks are added in the dock (IndexedDB).
 */
export const roosterFmPlaylist: readonly RoosterFmTrack[] = [
  {
    id: "a-room-at-daybreak",
    title: "A Room at Daybreak",
    artist: "Rooster FM",
    src: "/audio/A_Room_at_Daybreak.mp3",
  },
  {
    id: "window-seat-sunrise",
    title: "Window Seat Sunrise",
    artist: "Rooster FM",
    src: "/audio/Window_Seat_Sunrise.mp3",
  },
] as const;
