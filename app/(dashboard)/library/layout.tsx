export default function LibraryLayout({
  children,
  filters,
  grid,
}: {
  children: React.ReactNode;
  filters: React.ReactNode;
  grid: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {children}
      <div className="flex gap-6">
        {filters}
        <div className="flex-1 space-y-4">{grid}</div>
      </div>
    </div>
  );
}
