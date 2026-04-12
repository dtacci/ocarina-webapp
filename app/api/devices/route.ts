import { createClient } from "@/lib/supabase/server";

// GET — return the authenticated user's registered devices
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("devices")
    .select("id, name, device_type, capabilities, last_seen_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return Response.json({ devices: data ?? [] });
}
