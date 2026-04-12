import { z } from "zod";

export const kitSlotSchema = z.object({
  name: z.string().describe("Slot name (e.g. lead, rhythm, bass, drums, keys, mallets)"),
  family: z
    .enum(["strings", "brass", "woodwind", "keys", "mallet", "drums", "guitar", "other_perc", "other", "fx"])
    .describe("Instrument family for this slot"),
  vibes: z.array(z.string()).describe("Vibe tags for sample search in this slot"),
  reasoning: z.string().describe("Why this instrument was chosen for the vibe"),
  optional: z.boolean().describe("Whether this slot is optional"),
});

export const kitBuilderSchema = z.object({
  id: z.string().describe("Kit ID in kebab-case (e.g. rainy-jazz-night)"),
  name: z.string().describe("Human-readable kit name"),
  description: z.string().describe("One-line description of the kit's character"),
  vibes: z.array(z.string()).describe("Overall vibe tags for the kit"),
  slots: z.array(kitSlotSchema).min(2).max(6).describe("Instrument slots (2-6)"),
  keyboardMap: z.record(z.string(), z.string()).describe("Keyboard zone mapping, e.g. { 'Q-T': 'lead', 'A-G': 'rhythm' }"),
});

export type KitBuilderResult = z.infer<typeof kitBuilderSchema>;
export type KitSlot = z.infer<typeof kitSlotSchema>;
