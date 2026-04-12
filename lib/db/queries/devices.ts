import { createClient } from "@/lib/supabase/server";

export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  device_type: string;
  capabilities: Record<string, boolean>;
  hardware_version: string | null;
  firmware_version: string | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
  created_at: string;
}

export async function getDevices(): Promise<DeviceRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getDevice(id: string): Promise<DeviceRow | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data;
}

export async function createDevice(
  name: string,
  deviceType: string,
  apiKeyHash: string | null,
  capabilities: Record<string, boolean>
): Promise<DeviceRow> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("devices")
    .insert({
      user_id: user.id,
      name,
      device_type: deviceType,
      api_key_hash: apiKeyHash,
      capabilities,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDevice(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("devices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
