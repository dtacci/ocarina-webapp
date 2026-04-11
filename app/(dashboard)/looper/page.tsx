import { CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function LooperPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visual Looper</h1>
          <p className="text-muted-foreground">
            Real-time loop engine dashboard with track state and controls.
          </p>
        </div>
        <Badge variant="outline">v0.2</Badge>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <CircleDot className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Looper dashboard coming in v0.2</p>
          <p className="text-xs text-muted-foreground">
            Live track states, mute/solo/record controls, BPM display
          </p>
        </div>
      </div>
    </div>
  );
}
