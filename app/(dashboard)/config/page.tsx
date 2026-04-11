import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground">
            Manage your Ocarina&apos;s 70+ settings across 9 domains.
          </p>
        </div>
        <Badge variant="outline">v0.2</Badge>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Settings className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Config manager coming in v0.2</p>
          <p className="text-xs text-muted-foreground">
            Edit settings in browser, save to DB, download as YAML
          </p>
        </div>
      </div>
    </div>
  );
}
