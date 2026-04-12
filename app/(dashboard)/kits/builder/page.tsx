import { KitBuilderForm } from "@/components/kits/kit-builder-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function KitBuilderPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Button render={<Link href="/kits" />} variant="ghost" size="sm" className="gap-1.5 -ml-2">
        <ArrowLeft className="size-4" />
        All kits
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Kit Builder</h1>
        <p className="text-muted-foreground">
          Describe your perfect kit and watch the AI construct it slot-by-slot in real-time.
        </p>
      </div>

      <KitBuilderForm />
    </div>
  );
}
