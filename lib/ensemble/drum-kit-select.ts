import type { SongProfile } from "@/lib/ai/schemas";

/**
 * Pick a best-fit built-in drum kit for a profiled song so the groove sounds
 * like a kit rather than orchestral timpani. Ids come from drum-kit-manifest
 * (synth-808 / sample-808 / cassette-808 / acoustic). Heuristic by genre/vibes;
 * cassette-808 is the versatile default.
 */
export function pickDrumKit(profile: Pick<SongProfile, "genre" | "vibes">): string {
  const hay = `${profile.genre} ${profile.vibes.join(" ")}`.toLowerCase();

  // Acoustic-kit genres: live drums, organic feel.
  if (/jazz|folk|rock|soul|funk|blues|reggae|ska|dub|country|orchestr|classical|latin|gospel|acoustic|swing/.test(hay)) {
    return "acoustic";
  }
  // Clean electronic drum machine.
  if (/house|techno|edm|electro|dance|disco|synth|pop|club|trance/.test(hay)) {
    return "sample-808";
  }
  // Vintage / lo-fi / hip-hop → cassette character (also the default).
  return "cassette-808";
}
