import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely.
 * Use ONLY in server-side code for operations that need to act on behalf of a
 * device (Pi sync routes) or perform privileged admin queries.
 * Never expose this client or its key to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
