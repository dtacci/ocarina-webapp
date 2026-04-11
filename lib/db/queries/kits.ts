import { createClient } from "@/lib/supabase/server";

export interface KitRow {
  id: string;
  name: string;
  description: string | null;
  triggers: string[];
  vibes: string[];
  slots: Record<string, { family?: string; vibes?: string[]; optional?: boolean; [key: string]: unknown }>;
  keyboard_map: Record<string, string>;
  is_system: boolean;
}

export async function getKits(): Promise<KitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kits")
    .select("*")
    .eq("is_system", true)
    .order("name");

  if (error) throw error;
  return (data || []) as KitRow[];
}

export async function getKit(id: string): Promise<KitRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kits")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as KitRow;
}
