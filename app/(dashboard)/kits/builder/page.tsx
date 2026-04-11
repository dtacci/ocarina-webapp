import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function KitBuilderPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Kit Builder</h1>
          <p className="text-muted-foreground">
            Describe your perfect kit and watch the AI construct it slot-by-slot.
          </p>
        </div>
        <Badge variant="outline">streamObject</Badge>
      </div>
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Sparkles className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Coming next</p>
          <p className="text-xs text-muted-foreground">
            Uses Vercel AI SDK streamObject to build kits in real-time
          </p>
        </div>
      </div>
    </div>
  );
}
