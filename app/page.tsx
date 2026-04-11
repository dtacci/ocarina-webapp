import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Waves, Music, Mic, Layers, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Waves className="size-4" />
          </div>
          <span className="font-semibold">Digital Ocarina</span>
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

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Waves className="size-8" />
        </div>
        <div className="max-w-xl space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your instrument, in the cloud
          </h1>
          <p className="text-lg text-muted-foreground">
            Browse 4,886 orchestral samples, manage kits, sync recordings from
            your Ocarina, and explore with AI-powered search.
          </p>
        </div>
        <div className="flex gap-3">
          <Button render={<Link href="/signup" />} size="lg">
            Create account
          </Button>
          <Button render={<Link href="/login" />} size="lg" variant="outline">
            Sign in
          </Button>
        </div>

        <div className="mt-12 grid w-full max-w-3xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Music, title: "4,886 Samples", desc: "Orchestral library with rich metadata" },
            { icon: Layers, title: "12 Kits", desc: "Curated presets for every mood" },
            { icon: Mic, title: "AI Search", desc: "Find sounds by describing a vibe" },
            { icon: Activity, title: "Activity", desc: "Track your creative sessions" },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border p-4 text-left">
              <item.icon className="mb-2 size-5 text-muted-foreground" />
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Digital Ocarina &mdash; Voice-to-instrument synthesizer
      </footer>
    </div>
  );
}
