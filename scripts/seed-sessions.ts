/**
 * Seed mock session data for activity timeline demo.
 * Generates ~180 sessions over the last 6 months with realistic patterns.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/seed-sessions.ts <user_id>
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: npx tsx scripts/seed-sessions.ts <user_id>");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const modes = ["instrument", "karaoke", "looper", "madlibs"];
const modeWeights = [0.5, 0.2, 0.2, 0.1]; // instrument most common

const kitIds = [
  "jazz-lounge", "classical-chamber", "blues-rock", "reggae-vibes",
  "ambient-chill", "orchestral-epic", "80s-metal", "dark-ambient",
  "upbeat-pop", "experimental", "funk-80s", "folk-acoustic",
];

const vibePool = [
  "warm", "dark", "bright", "mellow", "energetic", "dreamy",
  "gritty", "smooth", "ethereal", "funky", "jazzy", "cinematic",
  "haunting", "playful", "aggressive", "tender", "mysterious",
  "uplifting", "melancholic", "groovy", "lo-fi", "epic",
];

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomVibes(): string[] {
  const count = randomInt(1, 4);
  const shuffled = [...vibePool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function seed() {
  const sessions: Record<string, unknown>[] = [];
  const now = new Date();

  // Generate sessions over last 180 days
  for (let daysAgo = 180; daysAgo >= 0; daysAgo--) {
    // Variable activity: some days 0, some 1-3 sessions
    const dayActivity = Math.random();
    let sessionsToday: number;
    if (dayActivity < 0.35) sessionsToday = 0; // 35% no activity
    else if (dayActivity < 0.65) sessionsToday = 1; // 30% one session
    else if (dayActivity < 0.85) sessionsToday = 2; // 20% two sessions
    else sessionsToday = 3; // 15% three sessions

    // Weekend bonus
    const dayOfWeek = new Date(now.getTime() - daysAgo * 86400000).getDay();
    if ((dayOfWeek === 0 || dayOfWeek === 6) && sessionsToday > 0) {
      sessionsToday = Math.min(sessionsToday + 1, 4);
    }

    for (let s = 0; s < sessionsToday; s++) {
      const startHour = randomInt(8, 23);
      const startMinute = randomInt(0, 59);
      const startDate = new Date(now.getTime() - daysAgo * 86400000);
      startDate.setHours(startHour, startMinute, 0, 0);

      const durationSec = randomInt(120, 3600); // 2 min to 1 hour
      const endDate = new Date(startDate.getTime() + durationSec * 1000);
      const mode = weightedRandom(modes, modeWeights);

      sessions.push({
        user_id: userId,
        started_at: startDate.toISOString(),
        ended_at: endDate.toISOString(),
        duration_sec: durationSec,
        kit_id: mode === "instrument" || mode === "looper"
          ? kitIds[randomInt(0, kitIds.length - 1)]
          : null,
        samples_played: mode === "instrument" ? randomInt(5, 80) : randomInt(0, 10),
        loops_recorded: mode === "looper" ? randomInt(1, 12) : 0,
        vibes_used: randomVibes(),
        mode,
        metadata: null,
      });
    }
  }

  console.log(`Seeding ${sessions.length} mock sessions...`);

  // Insert in batches of 100
  for (let i = 0; i < sessions.length; i += 100) {
    const batch = sessions.slice(i, i + 100);
    const { error } = await supabase.from("sessions").insert(batch);
    if (error) {
      console.error(`Batch ${i / 100 + 1} failed:`, error.message);
    } else {
      console.log(`Batch ${i / 100 + 1}: ${batch.length} sessions inserted`);
    }
  }

  console.log("Done! Total sessions:", sessions.length);
}

seed().catch(console.error);
