import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE /api/devices/:id — removes a device the caller owns.
// Dependent rows (recordings, sessions, sync_queue, device_configs,
// device_commands) have their device_id nulled out so the user's own
// activity history survives the delete. device_pairings rows are nulled
// automatically via ON DELETE SET NULL.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: device } = await supabase
    .from("devices")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!device) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const dependentTables = [
    "recordings",
    "sessions",
    "sync_queue",
    "device_configs",
    "device_commands",
  ] as const;

  for (const table of dependentTables) {
    const { error } = await admin
      .from(table)
      .update({ device_id: null })
      .eq("device_id", id);
    if (error) {
      return Response.json(
        { error: `Failed to clear ${table} references` },
        { status: 500 }
      );
    }
  }

  const { error: deleteErr } = await admin
    .from("devices")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return Response.json({ error: "Failed to delete device" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
