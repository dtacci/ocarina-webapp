import { AISearch } from "@/components/samples/ai-search";

export default function LibraryPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sample Library</h1>
        <p className="text-muted-foreground">
          Browse 3,859 orchestral samples. Filter by family, vibes, and attributes.
        </p>
      </div>
      <AISearch />
    </>
  );
}
