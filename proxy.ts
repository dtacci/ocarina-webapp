import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Device API key auth for /api/v1/* routes is handled inside the route
  // handlers themselves (needs DB access — edge middleware just passes through).
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static files, _next internals, and public
    // metadata (the manifest must never redirect to /login — browsers fetch
    // it without credentials and would choke parsing the login HTML as JSON).
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
