import { notFound } from "next/navigation";
import { getSample } from "@/lib/db/queries/samples";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SamplePlayer } from "@/components/audio/sample-player";
import Link from "next/link";
import { ArrowLeft, Mic } from "lucide-react";

interface Props {
  params: Promise<{ sampleId: string }>;
}

const familyColors: Record<string, string> = {
  strings: "bg-violet-500",
  brass: "bg-amber-500",
  woodwind: "bg-emerald-500",
  keys: "bg-blue-500",
  drums: "bg-red-500",
  guitar: "bg-orange-500",
  mallet: "bg-cyan-500",
  other_perc: "bg-pink-500",
  other: "bg-gray-500",
  fx: "bg-purple-500",
};

function AttributeBar({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}/10</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${value * 10}%` }}
        />
      </div>
    </div>
  );
}

export default async function SampleDetailPage({ params }: Props) {
  const { sampleId } = await params;
  const sample = await getSample(decodeURIComponent(sampleId));
  if (!sample) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Button render={<Link href="/library" />} variant="ghost" size="sm" className="gap-1.5 -ml-2">
        <ArrowLeft className="size-4" />
        Library
      </Button>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">{sample.id}</h1>
          {sample.family && (
            <Badge className={`${familyColors[sample.family] ?? "bg-gray-500"} text-white text-xs`}>
              {sample.family}
            </Badge>
          )}
        </div>
        {sample.category && (
          <p className="text-muted-foreground capitalize">{sample.category}</p>
        )}
      </div>

      {/* Audio — preview if available, otherwise decorative waveform */}
      {sample.mp3_blob_url ? (
        <div className="space-y-2">
          <SamplePlayer blobUrl={sample.mp3_blob_url} duration={sample.duration_sec} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mic className="size-3.5 shrink-0" />
            <span>6-second preview. Say <span className="font-medium text-foreground">&ldquo;load {sample.family ?? "sample"}&rdquo;</span> to hear the full sample on your Pi.</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-end gap-px h-16">
            {Array.from({ length: 60 }, (_, i) => {
              const h = Math.max(8, Math.abs(Math.sin(i * 0.4 + sample.id.charCodeAt(i % sample.id.length) * 0.1)) * 100);
              return (
                <div key={i} className="flex-1 rounded-sm bg-foreground/20" style={{ height: `${h}%` }} />
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mic className="size-3.5 shrink-0" />
            <span>Audio lives on your Pi. Say <span className="font-medium text-foreground">&ldquo;load {sample.family ?? "sample"}&rdquo;</span> or use voice search to hear it.</span>
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <span className="text-xs text-muted-foreground">Duration</span>
          <p className="text-sm font-medium">{sample.duration_sec.toFixed(2)}s</p>
        </div>
        <div className="rounded-lg border p-3">
          <span className="text-xs text-muted-foreground">Sample Rate</span>
          <p className="text-sm font-medium">{(sample.sample_rate / 1000).toFixed(1)} kHz</p>
        </div>
        {sample.root_note && (
          <div className="rounded-lg border p-3">
            <span className="text-xs text-muted-foreground">Root Note</span>
            <p className="text-sm font-medium">{sample.root_note}</p>
          </div>
        )}
        {sample.root_freq && (
          <div className="rounded-lg border p-3">
            <span className="text-xs text-muted-foreground">Frequency</span>
            <p className="text-sm font-medium">{sample.root_freq} Hz</p>
          </div>
        )}
      </div>

      {/* Attribute bars */}
      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-medium">Attributes</h2>
        <AttributeBar label="Brightness" value={sample.brightness} />
        <AttributeBar label="Warmth" value={sample.warmth} />
        <AttributeBar label="Attack" value={sample.attack} />
        <AttributeBar label="Sustain" value={sample.sustain} />
        <AttributeBar label="Texture" value={sample.texture} />
      </div>

      {/* Vibes */}
      {sample.vibes.length > 0 && (
        <div>
          <h2 className="text-sm font-medium uppercase text-muted-foreground tracking-wider mb-2">
            Vibes
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {sample.vibes.map((v) => (
              <Badge key={v} variant="outline">{v}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {sample.loopable && <Badge variant="secondary">Loopable</Badge>}
        {sample.is_system && <Badge variant="secondary">System</Badge>}
      </div>
    </div>
  );
}
