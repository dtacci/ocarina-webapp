"use client";

/**
 * Client boundary for the DJ surface. `ssr: false` is only legal inside a
 * Client Component (next/dynamic rule), and the surface owns a live Tone.js
 * graph that must never run on the server.
 */
import dynamic from "next/dynamic";
import type { DjSource } from "@/lib/db/queries/dj";

const DjSurface = dynamic(
  () => import("./dj-surface").then((m) => m.DjSurface),
  { ssr: false },
);

export function DjClient({ sources }: { sources: DjSource[] }) {
  return <DjSurface sources={sources} />;
}
