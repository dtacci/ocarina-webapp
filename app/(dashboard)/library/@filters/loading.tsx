import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-56 shrink-0 space-y-3">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}
