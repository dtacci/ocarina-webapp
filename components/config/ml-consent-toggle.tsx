"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Account-level opt-in for ML interaction logging. When on, the device and
 * webapp record playing/search interactions (docs/EVENTS.md) to improve
 * search and recommendations. When off, no events are ever created.
 */
export function MlConsentToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch("/api/account/ml-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) setEnabled(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Help improve the AI</p>
            <p className="text-muted-foreground">
              Share playing and search interactions (voice commands, sample
              picks, ratings) to improve search and recommendations. Your
              device honors this within a minute; turning it off stops all
              logging immediately.
            </p>
          </div>
        </div>
        <Button
          variant={enabled ? "default" : "outline"}
          size="sm"
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
        >
          {enabled ? "On" : "Off"}
        </Button>
      </CardContent>
    </Card>
  );
}
