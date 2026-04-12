import { ImageResponse } from "next/og";
import { getPublicRecording } from "@/lib/db/queries/recordings";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Decorative waveform bars — pure layout, no canvas/audio needed
const BAR_HEIGHTS = [
  30, 55, 70, 48, 80, 62, 44, 90, 58, 72, 40, 85, 65, 50, 76,
  38, 68, 82, 52, 74, 44, 88, 60, 70, 46, 80, 56, 66, 42, 78,
];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OGImage({ params }: Props) {
  const { id } = await params;

  // Crawlers fetch this without auth — use the public query.
  // If not found or not public, fall back to generic branded card.
  const recording = await getPublicRecording(id).catch(() => null);

  const title = recording?.title
    ? recording.title.length > 52
      ? recording.title.slice(0, 49) + "…"
      : recording.title
    : null;

  const meta: string[] = [];
  if (recording?.duration_sec) meta.push(formatDuration(recording.duration_sec));
  if (recording?.bpm) meta.push(`${recording.bpm} BPM`);
  if (recording?.kit_id) meta.push(recording.kit_id.replace(/-/g, " "));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090b", // zinc-950
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: music note icon */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "#7c3aed", // violet-600
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            ♪
          </div>
        </div>

        {/* Middle: title + waveform */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Decorative waveform */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "90px",
            }}
          >
            {BAR_HEIGHTS.map((h, i) => (
              <div
                key={i}
                style={{
                  width: "16px",
                  height: `${h}%`,
                  backgroundColor: i < 18 ? "#7c3aed" : "#3f3f46", // violet for "played", zinc for rest
                  borderRadius: "3px",
                  opacity: i < 18 ? 1 : 0.5,
                }}
              />
            ))}
          </div>

          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                fontSize: title ? 56 : 44,
                fontWeight: 700,
                color: "#fafafa",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              {title ?? "Digital Ocarina Recording"}
            </div>
            {meta.length > 0 && (
              <div
                style={{
                  fontSize: 28,
                  color: "#a1a1aa", // zinc-400
                  letterSpacing: "0.02em",
                }}
              >
                {meta.join("  ·  ")}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: "#52525b", // zinc-600
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {recording ? "Listen on" : ""}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: "#71717a", // zinc-500
              letterSpacing: "-0.01em",
            }}
          >
            Digital Ocarina
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
