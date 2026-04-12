import { getFamilyCounts } from "@/lib/db/queries/samples";
import { createClient } from "@/lib/supabase/server";
import { FilterSidebar } from "@/components/samples/filter-sidebar";

export default async function FiltersSlot() {
  const supabase = await createClient();
  const [familyCounts, userResp] = await Promise.all([
    getFamilyCounts(),
    supabase.auth.getUser(),
  ]);
  const signedIn = !!userResp.data.user;

  return <FilterSidebar familyCounts={familyCounts} signedIn={signedIn} />;
}
