import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const provider = cookieStore.get("ai_provider")?.value ?? "anthropic";
  return Response.json({ provider });
}

export async function POST(request: Request) {
  const { provider } = await request.json();

  if (!["anthropic", "openai"].includes(provider)) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set("ai_provider", provider, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  return Response.json({ provider });
}
