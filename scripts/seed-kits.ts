/**
 * Seed the kits table from the Digital Ocarina kit JSON files.
 *
 * Usage: npx tsx scripts/seed-kits.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const OCARINA_REPO = resolve(__dirname, "../../digital-ocarina");
const KITS_DIR = resolve(OCARINA_REPO, "samples/kits");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function seedKits() {
  const files = readdirSync(KITS_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} kit files in ${KITS_DIR}`);

  // Check if already seeded
  const { count } = await supabase
    .from("kits")
    .select("*", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`Kits table already has ${count} rows. Skipping. Use --force to re-seed.`);
    if (!process.argv.includes("--force")) return;
    console.log("--force: deleting existing kits...");
    await supabase.from("kits").delete().neq("id", "");
  }

  const kits = files.map((f) => {
    const raw = JSON.parse(readFileSync(resolve(KITS_DIR, f), "utf-8"));
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description || null,
      triggers: raw.triggers || [],
      vibes: raw.vibes || [],
      slots: raw.slots || {},
      keyboard_map: raw.keyboard_map || {},
      is_system: true,
    };
  });

  const { error } = await supabase.from("kits").insert(kits);
  if (error) {
    console.error("Error seeding kits:", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${kits.length} kits: ${kits.map((k) => k.id).join(", ")}`);
}

seedKits().catch((e) => {
  console.error(e);
  process.exit(1);
});
