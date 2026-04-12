import Link from "next/link";
import { Waves } from "lucide-react";
import { SineVisualizer } from "./sine-visualizer";

interface Props {
  /** mono eyebrow label, e.g. "SESSION // SIGN-IN" */
  eyebrow: string;
  /** Serif headline shown on the brand panel */
  headline: string;
  /** Small supporting paragraph under the headline */
  subhead: string;
  /** Right-side form content */
  children: React.ReactNode;
}

export function AuthShell({ eyebrow, headline, subhead, children }: Props) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Ambient desk-lamp glow */}
      <div className="pointer-events-none absolute inset-0 auth-lamp" aria-hidden />
      <div className="pointer-events-none absolute inset-0 auth-scanlines opacity-60" aria-hidden />

      {/* Top-left compact brand link — present on all widths */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground glow-amber transition-transform group-hover:rotate-[-6deg]">
            <Waves className="size-3.5" />
          </span>
          Digital Ocarina
        </Link>
        <span className="hidden text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground/70 sm:inline">
          v0.1 · studio
        </span>
      </header>

      <div className="relative z-10 grid min-h-[calc(100vh-5rem)] grid-cols-1 gap-12 px-6 pb-12 md:grid-cols-[1.05fr_1fr] md:gap-16 md:px-10 lg:px-16">
        {/* ── Brand panel ───────────────────────────────────────────── */}
        <section className="relative hidden flex-col justify-between md:flex">
          <div className="space-y-10 pt-6">
            <span
              className="auth-rise inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground"
              style={{ ["--auth-delay" as string]: "40ms" }}
            >
              <span className="auth-caret inline-block size-1.5 rounded-full bg-primary" />
              {eyebrow}
            </span>

            <h1
              className="auth-rise text-balance text-5xl leading-[0.98] tracking-tight lg:text-6xl"
              style={{ ["--auth-delay" as string]: "120ms" }}
            >
              {headline}
            </h1>

            <p
              className="auth-rise max-w-md text-base leading-relaxed text-muted-foreground"
              style={{ ["--auth-delay" as string]: "200ms" }}
            >
              {subhead}
            </p>
          </div>

          <div
            className="auth-rise relative -mx-2 mt-12 h-48 overflow-hidden"
            style={{ ["--auth-delay" as string]: "300ms" }}
          >
            <SineVisualizer />
          </div>

          <div
            className="auth-rise mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70"
            style={{ ["--auth-delay" as string]: "380ms" }}
          >
            <span>
              <span className="text-foreground/70">4,886</span> samples
            </span>
            <span>
              <span className="text-foreground/70">12</span> kits
            </span>
            <span>
              <span className="text-foreground/70">1,084</span> karaoke songs
            </span>
          </div>
        </section>

        {/* ── Form card ─────────────────────────────────────────────── */}
        <section className="flex w-full items-center justify-center md:justify-start">
          <div
            className="auth-rise auth-glass w-full max-w-md rounded-2xl p-6 sm:p-8"
            style={{ ["--auth-delay" as string]: "140ms" }}
          >
            {/* Mobile-only eyebrow so the mono tag is still visible */}
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground md:hidden">
              <span className="auth-caret inline-block size-1.5 rounded-full bg-primary" />
              {eyebrow}
            </span>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
