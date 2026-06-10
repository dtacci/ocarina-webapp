import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase keep-alive, hit daily by the Vercel cron in vercel.json.
 *
 * Free-tier Supabase pauses projects after ~7 days without activity; a paused
 * project drops off DNS entirely and the first visitor gets hard failures
 * (and a multi-minute restore). One trivial query a day keeps it awake.
 *
 * If CRON_SECRET is set in the environment, Vercel sends it as a Bearer token
 * and we reject anything else; unset (e.g. local dev), the route is open —
 * it leaks nothing and does nothing destructive.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("recordings")
    .select("id", { count: "exact", head: true })
    .limit(1);

  if (error) {
    console.error("[keepalive] DB ping failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
