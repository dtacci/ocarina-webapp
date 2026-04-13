export default async function SampleEditorPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl tracking-tight lowercase">sample editor</h1>
        <p className="text-muted-foreground lowercase mt-1">
          refine field recordings into finished samples.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            drafts · 0 recordings awaiting edit
          </h2>
        </div>
        <div className="rounded border border-dashed border-border/60 px-4 py-8 text-sm text-muted-foreground">
          no field recordings waiting. record something on your ocarina — it&apos;ll show up here.
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          your samples · saved to library
        </h2>
        <div className="rounded border border-dashed border-border/60 px-4 py-8 text-sm text-muted-foreground">
          no user samples yet.
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          recent edits
        </h2>
        <div className="rounded border border-dashed border-border/60 px-4 py-6 text-xs text-muted-foreground font-mono">
          no edits yet.
        </div>
      </section>
    </div>
  );
}
