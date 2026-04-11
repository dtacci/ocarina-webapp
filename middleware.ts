import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Device API key auth for /api/v1/* routes
  if (request.nextUrl.pathname.startsWith("/api/v1/")) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // API key validation happens in the route handler (needs DB access)
    // Edge middleware just checks presence
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static files and _next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
