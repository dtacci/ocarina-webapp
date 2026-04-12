import { streamObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { kitBuilderSchema } from "@/lib/ai/kit-builder-schema";

const SYSTEM = `You are the Digital Ocarina's AI Kit Builder. You create instrument kits for a voice-to-instrument synthesizer with a 3,859-sample orchestral library.

A kit has 2-6 instrument "slots", each mapped to a keyboard zone. When the user plays, each zone triggers samples from that slot's instrument family with matching vibes.

Available instrument families (with sample counts):
- strings (1,071): violins, violas, cellos, basses, ensembles
- woodwind (2,644): flutes, clarinets, oboes, bassoons, saxophones
- keys (741): pianos, organs, harpsichords, synths
- drums (115): percussion, timpani, snare, bass drum
- brass (105): trumpets, trombones, tubas, French horns
- guitar (106): acoustic, classical, electric
- mallet (48): vibraphone, marimba, xylophone, glockenspiel
- other_perc (48): miscellaneous percussion
- fx (3): sound effects

Keyboard zones (QWERTY layout, left to right):
- Q-T (5 keys): typically lead/melody
- Y-] (7 keys): typically secondary/accompaniment
- A-G (7 keys): typically rhythm/chords
- H-' (6 keys): typically bass/low end

Design principles:
- Every kit needs a lead voice and rhythmic foundation
- Contrast is key: pair bright leads with warm backing
- Mark auxiliary/color instruments as optional
- The vibe tags you choose determine which samples get selected — be specific
- Explain your reasoning for each slot choice`;

export async function POST(request: Request) {
  const { description } = await request.json();

  if (!description || typeof description !== "string" || description.length > 500) {
    return Response.json({ error: "Invalid description" }, { status: 400 });
  }

  const result = streamObject({
    model: getModel("kit-builder"),
    schema: kitBuilderSchema,
    system: SYSTEM,
    prompt: `Build a kit for: "${description}"`,
  });

  return result.toTextStreamResponse();
}
