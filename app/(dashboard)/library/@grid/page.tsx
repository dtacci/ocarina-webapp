import { getSamples, type SampleFilters } from "@/lib/db/queries/samples";
import { getUserSampleData } from "@/lib/db/queries/sample-user-data";
import { createClient } from "@/lib/supabase/server";
import { SampleGrid } from "@/components/samples/sample-grid";
import { Pagination } from "@/components/samples/pagination";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseFilters(raw: Record<string, string | string[] | undefined>): SampleFilters {
  const str = (key: string) => {
    const v = raw[key];
    return typeof v === "string" ? v : undefined;
  };
  const num = (key: string) => {
    const v = str(key);
    return v ? parseInt(v, 10) : undefined;
  };

  return {
    family: str("family"),
    category: str("category"),
    vibes: str("vibes")?.split(",").filter(Boolean),
    brightnessMin: num("bMin"),
    brightnessMax: num("bMax"),
    warmthMin: num("wMin"),
    warmthMax: num("wMax"),
    attackMin: num("aMin"),
    attackMax: num("aMax"),
    sustainMin: num("sMin"),
    sustainMax: num("sMax"),
    search: str("q"),
    page: num("page"),
  };
}

export default async function GridSlot({ searchParams }: Props) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  const supabase = await createClient();
  const [result, userResp] = await Promise.all([
    getSamples(filters),
    supabase.auth.getUser(),
  ]);

  const userId = userResp.data.user?.id;
  const userData = userId
    ? await getUserSampleData(
        userId,
        result.samples.map((s) => s.id)
      )
    : undefined;

  return (
    <>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} />
      <SampleGrid samples={result.samples} userData={userData} />
      {result.totalPages > 1 && (
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} />
      )}
    </>
  );
}
