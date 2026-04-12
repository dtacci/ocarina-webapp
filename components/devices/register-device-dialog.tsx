"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Plus, Key, AlertTriangle } from "lucide-react";

const deviceTypes = [
  {
    value: "pi_pro",
    label: "Raspberry Pi",
    description: "Full-featured Ocarina with Pi 5",
    capabilities: ["sync", "looper", "karaoke", "samples", "config", "realtime"],
  },
  {
    value: "mobile_app",
    label: "Mobile App",
    description: "iOS/Android companion app",
    capabilities: ["sync", "looper", "karaoke", "samples", "config", "realtime"],
  },
  {
    value: "arduino_lite",
    label: "Arduino Lite",
    description: "Minimal Ocarina (sync only)",
    capabilities: ["sync"],
  },
];

export function RegisterDeviceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "key">("form");
  const [name, setName] = useState("");
  const [type, setType] = useState("pi_pro");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), deviceType: type }),
      });

      if (!res.ok) throw new Error("Registration failed");

      const { apiKey: key } = await res.json();
      setApiKey(key);
      setStep("key");
    } catch {
      // Could add toast here
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDone() {
    setOpen(false);
    setStep("form");
    setName("");
    setApiKey(null);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-4" />
        Register Device
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      {step === "form" ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Register a New Device</h2>
            <p className="text-sm text-muted-foreground">
              Give your Ocarina a name and select its type.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Device Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dan's Ocarina"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Device Type</label>
            <div className="grid gap-2">
              {deviceTypes.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => setType(dt.value)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    type === dt.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium">{dt.label}</div>
                    <div className="text-xs text-muted-foreground">{dt.description}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {dt.capabilities.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px] px-1 py-0">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? "Registering..." : "Register"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Key className="size-5" />
              API Key Generated
            </h2>
            <p className="text-sm text-muted-foreground">
              Save this key now — it won&apos;t be shown again.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
            <code className="flex-1 text-xs font-mono break-all select-all">
              {apiKey}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
            <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong>Add this to your Pi&apos;s .env file:</strong>
              <pre className="mt-1 text-[10px] font-mono">OCARINA_API_KEY={apiKey}</pre>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleDone}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
