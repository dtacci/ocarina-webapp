import { getFamilyCounts } from "@/lib/db/queries/samples";
import { FilterSidebar } from "@/components/samples/filter-sidebar";

export default async function FiltersSlot() {
  const familyCounts = await getFamilyCounts();

  return <FilterSidebar familyCounts={familyCounts} />;
}
