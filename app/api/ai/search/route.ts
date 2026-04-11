import { generateObject } from "ai";
import { getModel } from "@/lib/ai/provider";
import { sampleSearchSchema } from "@/lib/ai/schemas";
import { SAMPLE_SEARCH_SYSTEM } from "@/lib/ai/prompts";

export async function POST(request: Request) {
  const { query } = await request.json();

  if (!query || typeof query !== "string" || query.length > 500) {
    return Response.json({ error: "Invalid query" }, { status: 400 });
  }

  const result = await generateObject({
    model: getModel("search"),
    schema: sampleSearchSchema,
    system: SAMPLE_SEARCH_SYSTEM,
    prompt: query,
  });

  return Response.json(result.object);
}
