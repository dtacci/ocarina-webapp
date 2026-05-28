import { redirect } from "next/navigation";

/**
 * /diagnostics/live retired May 2026 — the same Realtime-source flow lives
 * on as /monitor?realtime=1. Keeping this route as a redirect so any external
 * bookmarks don't 404.
 */
export default function LiveConsoleRedirect() {
  redirect("/monitor?realtime=1");
}
