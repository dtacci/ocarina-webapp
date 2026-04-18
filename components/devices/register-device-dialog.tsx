"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Key,
  Plus,
  Radio,
} from "lucide-react";

type NearbyPairing = {
  pairingCode: string;
  nameHint: string | null;
  hardwareVersion: string | null;
  createdAt: string;
};

const NEARBY_POLL_MS = 3000;

const advancedDeviceTypes = [
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

function formatCode(code: string): string {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function RegisterDeviceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyPairing[]>([]);

  // Advanced manual-key path (kept for backwards compat / dev).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advName, setAdvName] = useState("");
  const [advType, setAdvType] = useState("pi_pro");
  const [advLoading, setAdvLoading] = useState(false);
  const [advApiKey, setAdvApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchNearby = useCallback(async () => {
    try {
      const res = await fetch("/api/devices/pair/nearby", { cache: "no-store" });
      if (!res.ok) return;
      const { pairings } = (await res.json()) as { pairings: NearbyPairing[] };
      setNearby(pairings);
    } catch {
      // Silent — nearby is a convenience, not required.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchNearby();
    const id = setInterval(fetchNearby, NEARBY_POLL_MS);
    return () => clearInterval(id);
  }, [open, fetchNearby]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit code your Ocarina spoke.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/devices/pair/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingCode: digits,
          name: name.trim() || undefined,
          deviceType: "pi_pro",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "Pairing failed");
        return;
      }
      setSuccess(
        `Paired as ${body.device?.name ?? "your Ocarina"}. It should finish connecting in a few seconds.`
      );
      setCode("");
      setName("");
      router.refresh();
    } catch {
      setError("Pairing failed — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvancedRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!advName.trim() || advLoading) return;
    setAdvLoading(true);
    try {
      const res = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: advName.trim(), deviceType: advType }),
      });
      if (!res.ok) throw new Error();
      const { apiKey } = await res.json();
      setAdvApiKey(apiKey);
    } catch {
      setError("Registration failed");
    } finally {
      setAdvLoading(false);
    }
  }

  function handleCopy() {
    if (!advApiKey) return;
    navigator.clipboard.writeText(advApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function close() {
    setOpen(false);
    setCode("");
    setName("");
    setError(null);
    setSuccess(null);
    setAdvancedOpen(false);
    setAdvName("");
    setAdvApiKey(null);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-4" />
        Pair an Ocarina
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Pair an Ocarina</h2>
        <p className="text-sm text-muted-foreground">
          Power on your Ocarina and wait for it to speak a 6-digit code. Enter it
          below — no SSH required.
        </p>
      </div>

      {nearby.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Radio className="size-3.5" />
            Nearby Ocarinas
          </div>
          <div className="space-y-1.5">
            {nearby.map((p) => (
              <button
                key={p.pairingCode}
                type="button"
                onClick={() => setCode(p.pairingCode)}
                className={`w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                  code.replace(/\D/g, "") === p.pairingCode
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.nameHint || "Ocarina waiting to pair"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    On this network · code {formatCode(p.pairingCode)}
                  </div>
                </div>
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleClaim} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Pairing code</label>
          <Input
            value={formatCode(code)}
            onChange={(e) => setCode(e.target.value)}
            placeholder="482-651"
            inputMode="numeric"
            autoComplete="off"
            disabled={loading}
            className="font-mono tracking-widest text-center text-lg"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Name <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dan's Ocarina"
            disabled={loading}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs">{success}</p>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={close}>
            {success ? "Done" : "Cancel"}
          </Button>
          {!success && (
            <Button type="submit" disabled={loading || code.replace(/\D/g, "").length !== 6}>
              {loading ? "Pairing..." : "Pair"}
            </Button>
          )}
        </div>
      </form>

      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {advancedOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          Advanced: generate an API key manually
        </button>

        {advancedOpen && !advApiKey && (
          <form onSubmit={handleAdvancedRegister} className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Device Name</label>
              <Input
                value={advName}
                onChange={(e) => setAdvName(e.target.value)}
                placeholder="Dan's Ocarina"
                disabled={advLoading}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Device Type</label>
              <div className="grid gap-2">
                {advancedDeviceTypes.map((dt) => (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setAdvType(dt.value)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      advType === dt.value
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
            <div className="flex justify-end">
              <Button type="submit" disabled={!advName.trim() || advLoading}>
                {advLoading ? "Registering..." : "Generate API key"}
              </Button>
            </div>
          </form>
        )}

        {advancedOpen && advApiKey && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
              <Key className="size-4 shrink-0 text-muted-foreground" />
              <code className="flex-1 text-xs font-mono break-all select-all">
                {advApiKey}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
              <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong>Add this to your Pi&apos;s .env file:</strong>
                <pre className="mt-1 text-[10px] font-mono">OCARINA_API_KEY={advApiKey}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
