import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDjSources } from "@/lib/db/queries/dj";
import { DjClient } from "@/components/dj/dj-client";

export const metadata = {
  title: "DJ Decks — Digital Ocarina",
};

export default async function DjPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sources = await getDjSources();
  return <DjClient sources={sources} />;
}
