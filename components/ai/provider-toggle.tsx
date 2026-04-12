"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export function ProviderToggle() {
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/ai/provider")
      .then((r) => r.json())
      .then((d) => setProvider(d.provider))
      .catch(() => {});
  }, []);

  async function toggle() {
    const next = provider === "anthropic" ? "openai" : "anthropic";
    setSwitching(true);
    try {
      await fetch("/api/ai/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next }),
      });
      setProvider(next);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={switching}
      className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 disabled:opacity-50"
      title={`Using ${provider === "anthropic" ? "Claude (Anthropic)" : "GPT (OpenAI)"}. Click to switch.`}
    >
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 font-mono ${
          provider === "anthropic"
            ? "border-orange-400 text-orange-600 dark:text-orange-400"
            : "border-green-400 text-green-600 dark:text-green-400"
        }`}
      >
        {provider === "anthropic" ? "Claude" : "GPT"}
      </Badge>
    </button>
  );
}
