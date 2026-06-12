import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SYNTH_808_MANIFEST,
  VOICE_COUNT,
  type KitManifest,
} from "@/lib/audio/drum-kit-manifest";

/**
 * Drum kits = synth built-ins + every public/kits/<dir>/manifest.json.
 * Dropping a folder of WAVs + a manifest into public/kits ships a new kit
 * with no code change; the picker and engine consume the same shape.
 */
export async function GET() {
  const kits: KitManifest[] = [SYNTH_808_MANIFEST];
  const root = join(process.cwd(), "public", "kits");
  let dirs: string[] = [];
  try {
    dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    /* no kits dir — synth only */
  }
  for (const dir of dirs) {
    try {
      const raw = JSON.parse(readFileSync(join(root, dir, "manifest.json"), "utf-8"));
      if (
        typeof raw.id === "string" &&
        typeof raw.name === "string" &&
        raw.kind === "sample" &&
        Array.isArray(raw.voices) &&
        raw.voices.length === VOICE_COUNT
      ) {
        kits.push({ id: raw.id, name: raw.name, kind: "sample", voices: raw.voices });
      }
    } catch (err) {
      // Folder without a (valid) manifest ships no kit — log so a typo'd
      // manifest.json doesn't silently vanish from the picker.
      console.warn(`[kits] skipping public/kits/${dir}:`, err instanceof Error ? err.message : err);
    }
  }
  return Response.json(
    { kits },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
