import { z } from "zod";

export const sampleSearchSchema = z.object({
  vibes: z
    .array(z.string())
    .describe("Vibes/mood tags to search for (e.g. warm, dark, ethereal)"),
  family: z
    .enum([
      "strings", "brass", "woodwind", "keys", "mallet",
      "drums", "guitar", "other_perc", "other", "fx",
    ])
    .nullable()
    .describe("Instrument family to filter by, or null if not specified"),
  brightnessRange: z
    .tuple([z.number().min(1).max(10), z.number().min(1).max(10)])
    .nullable()
    .describe("Brightness range [min, max] on 1-10 scale, or null"),
  warmthRange: z
    .tuple([z.number().min(1).max(10), z.number().min(1).max(10)])
    .nullable()
    .describe("Warmth range [min, max] on 1-10 scale, or null"),
  attackRange: z
    .tuple([z.number().min(1).max(10), z.number().min(1).max(10)])
    .nullable()
    .describe("Attack speed range [min, max] on 1-10 scale (1=slow, 10=fast), or null"),
  sustainRange: z
    .tuple([z.number().min(1).max(10), z.number().min(1).max(10)])
    .nullable()
    .describe("Sustain length range [min, max] on 1-10 scale (1=short, 10=long), or null"),
  interpretation: z
    .string()
    .describe("Brief explanation of how you interpreted the search query"),
});

export type SampleSearchResult = z.infer<typeof sampleSearchSchema>;

/**
 * Structured profile of a looked-up song, used by the "sounds-like" ensemble
 * matcher. The LLM breaks the song into a handful of instrument roles, each
 * mapped to the closest orchestral-library family + a timbre phrase we embed
 * for semantic matching. Lead vocals are represented as a melodic 'lead' role
 * (the user plays/sings them), never matched as a vocal timbre.
 */
export const songProfileSchema = z.object({
  genre: z.string().describe("Primary genre/style, e.g. 'reggae', 'synth-pop'"),
  mood: z.string().describe("Overall mood in a few words, e.g. 'relaxed and uplifting'"),
  vibes: z
    .array(z.string())
    .describe("3-6 mood tags from the library vibe vocabulary (warm, gentle, mellow, ...)"),
  tempoFeel: z
    .enum(["slow", "medium", "fast"])
    .describe("Perceived tempo feel of the groove"),
  key: z.string().nullable().describe("Musical key if known (e.g. 'A major'), else null"),
  instruments: z
    .array(
      z.object({
        role: z
          .enum(["lead", "pad", "bass", "rhythm", "texture", "percussion"])
          .describe("Role in the arrangement"),
        instrument: z
          .string()
          .describe("The real instrument in the song, e.g. 'clean electric guitar', 'Hammond organ'"),
        family: z
          .enum([
            "strings", "brass", "woodwind", "keys", "mallet",
            "drums", "guitar", "other_perc", "other", "fx",
          ])
          .describe("Closest library family to approximate this instrument with"),
        character: z
          .string()
          .describe("Timbre to match — a short phrase we embed, e.g. 'warm sustained organ pad'"),
        prominence: z
          .number()
          .min(1)
          .max(10)
          .describe("How prominent in the mix (1=subtle, 10=dominant)"),
      }),
    )
    .min(1)
    .max(6)
    .describe("The key instruments/roles that define the song's sound (exclude vocal timbre)"),
  interpretation: z.string().describe("One sentence on how you read the song"),
});

export type SongProfile = z.infer<typeof songProfileSchema>;
