import Link from "next/link";
import { Sliders } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isOcarinaApiConfigured } from "@/lib/ocarina-api";
import { ConfiguratorSurface } from "@/components/configurator/configurator-surface";

export default async function ConfiguratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Sign in to use the configurator</p>
      </div>
    );
  }

  if (!isOcarinaApiConfigured()) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-card">
          <Sliders className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Pi API not configured</h1>
          <p className="text-sm text-muted-foreground">
            The configurator talks directly to your Pi&apos;s FastAPI server.
            Set <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">NEXT_PUBLIC_OCARINA_API</code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">NEXT_PUBLIC_OCARINA_TOKEN</code>{" "}
            in your Vercel env, then redeploy.
          </p>
        </div>
        <Link
          href="/monitor"
          className="inline-flex items-center rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Monitor instead →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurator</h1>
        <p className="text-muted-foreground text-sm">
          Live button mapping. Click a button to assign a note — changes apply
          immediately on the Ocarina. Save your mapping as a preset to recall
          it later.
        </p>
      </div>

      <ConfiguratorSurface />
    </div>
  );
}
