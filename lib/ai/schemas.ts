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
