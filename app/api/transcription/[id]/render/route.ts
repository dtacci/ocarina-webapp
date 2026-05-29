import { createClient } from "@/lib/supabase/server";
import { getRecordingById } from "@/lib/db/queries/recordings";
import { getRenderByHash, upsertRender } from "@/lib/db/queries/transcription";
import { paramsHash } from "@/lib/transcription/params-hash";
import { PARSER_VERSION } from "@/lib/transcription/index";
import type { DeriveParams } from "@/lib/transcription/types";

/**
 * Render cache for a transcription session (doc §3.8).
 *
 *  GET  ?hash=<sha256>   → cached render for these params (200) or 404 (miss).
 *  POST { params, musicxml, notation } → write-back a client-computed render.
 *
 * Owner-scoped: the caller must own the parent recording. RLS also enforces this
 * at the DB layer, but we check explicitly for a clean 403.
 */

async function requireOwner(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, status: 401 };
  const recording = await getRecordingById(id, user.id);
  if (!recording) return { error: "Not found" as const, status: 404 };
  return { user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owner = await requireOwner(id);
  if ("error" in owner) {
    return Response.json({ error: owner.error }, { status: owner.status });
  }

  const hash = new URL(request.url).searchParams.get("hash");
  if (!hash) {
    return Response.json({ error: "Missing hash" }, { status: 400 });
  }

  const render = await getRenderByHash(id, hash, PARSER_VERSION);
  if (!render) {
    return Response.json({ hit: false }, { status: 404 });
  }
  return Response.json({
    hit: true,
    musicxml: render.musicxml,
    notation: render.notation_jsonb,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owner = await requireOwner(id);
  if ("error" in owner) {
    return Response.json({ error: owner.error }, { status: owner.status });
  }

  let body: { params?: DeriveParams; musicxml?: string; notation?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.params || !body.musicxml) {
    return Response.json({ error: "Missing params or musicxml" }, { status: 400 });
  }

  // Hash server-side from the params — never trust a client-supplied hash.
  const hash = await paramsHash(body.params);
  const saved = await upsertRender({
    session_id: id,
    params_hash: hash,
    params_jsonb: body.params,
    parser_version: PARSER_VERSION,
    notation_jsonb: body.notation,
    musicxml: body.musicxml,
  });
  if (!saved) {
    return Response.json({ error: "Failed to save render" }, { status: 500 });
  }
  return Response.json({ ok: true, params_hash: hash });
}
