"use client";

/**
 * Client boundary for the mixer (ssr:false is only legal in Client
 * Components; the mix engine is a live Tone.js graph).
 */
import dynamic from "next/dynamic";
import type { MixerSurfaceProps } from "./mixer-surface";

const MixerSurface = dynamic(
  () => import("./mixer-surface").then((m) => m.MixerSurface),
  { ssr: false },
);

export function TracksClient(props: MixerSurfaceProps) {
  return <MixerSurface {...props} />;
}
