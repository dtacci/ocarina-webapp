import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Waves, Music, Mic, Layers, Activity, Sparkles,
  MonitorSmartphone, Code, ArrowRight,
} from "lucide-react";

const features = [
  { icon: Music, title: "4,886 Samples", desc: "Orchestral library with rich metadata and vibe-based search", delay: "0ms" },
  { icon: Sparkles, title: "AI Kit Builder", desc: "Describe a mood, watch AI build a kit slot-by-slot in real-time", delay: "60ms" },
  { icon: Mic, title: "AI Search", desc: "Find sounds with natural language — switchable Anthropic/OpenAI", delay: "120ms" },
  { icon: Layers, title: "12 Kit Presets", desc: "Curated instrument kits for jazz, orchestral, ambient, and more", delay: "180ms" },
  { icon: MonitorSmartphone, title: "Device Sync", desc: "Connect your Ocarina for automatic recording & config sync", delay: "240ms" },
  { icon: Activity, title: "Activity Heatmap", desc: "GitHub-style visualization of your creative sessions", delay: "300ms" },
  { icon: Code, title: "Embeddable Player", desc: "Share recordings with a minimal, iframeable audio player", delay: "360ms" },
  { icon: Waves, title: "Offline-First", desc: "Built for hardware that works without WiFi — cloud is optional", delay: "420ms" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground glow-amber">
            <Waves className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Digital Ocarina</span>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/login" />} variant="ghost" size="sm">
            Sign in
          </Button>
          <Button render={<Link href="/signup" />} size="sm">
            Get started
          </Button>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pt-28 pb-20 text-center relative overflow-hidden">
        {/* Ambient gradient background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
        </div>

        {/* Logo mark */}
        <div
          className="flex size-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl glow-amber"
          style={{ animation: "stagger-in 0.6s ease-out forwards" }}
        >
          <Waves className="size-10" />
        </div>

        {/* Headline */}
        <div className="max-w-2xl space-y-5" style={{ animation: "stagger-in 0.6s ease-out 0.1s forwards", opacity: 0 }}>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Your instrument,
            <br />
            <span className="text-gradient">in the cloud</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Browse 4,886 orchestral samples, build kits with AI, sync recordings
            from your Ocarina, and explore by vibe.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex gap-3" style={{ animation: "stagger-in 0.6s ease-out 0.2s forwards", opacity: 0 }}>
          <Button render={<Link href="/signup" />} size="lg" className="gap-2 glow-amber">
            Create account
            <ArrowRight className="size-4" />
          </Button>
          <Button render={<Link href="/login" />} size="lg" variant="outline">
            Sign in
          </Button>
        </div>

        {/* ── Feature grid ── */}
        <div
          className="mt-8 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger-fade"
          style={{ animation: "stagger-in 0.6s ease-out 0.35s forwards", opacity: 0 }}
        >
          {features.map((item) => (
            <div
              key={item.title}
              className="group rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 text-left transition-all hover:border-primary/30 hover:bg-card hover-lift"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <item.icon className="size-4" />
              </div>
              <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Tech stack badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4" style={{ animation: "stagger-in 0.6s ease-out 0.5s forwards", opacity: 0 }}>
          {["Next.js 15", "Supabase", "Vercel AI SDK", "Vercel Blob", "shadcn/ui", "Drizzle ORM"].map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-border/50 bg-card/30 px-3 py-1 text-[10px] font-medium text-muted-foreground tracking-wide uppercase"
            >
              {tech}
            </span>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Digital Ocarina — voice-to-instrument synthesizer
        </p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          4,886 samples &middot; 12 kits &middot; 888 karaoke songs &middot; 70+ config settings
        </p>
      </footer>
    </div>
  );
}
