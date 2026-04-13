"use client";

/**
 * A|B switch — a physical-looking toggle, not a shadcn Tabs / checkbox.
 *
 * "A" = bypass (hear original source)
 * "B" = chain active (hear effects)
 *
 * The square tab snaps between the two positions with a 120ms CSS transition —
 * the physicality is the point. This component alone anchors the
 * "hardware tool" metaphor every time the user glances at the transport.
 *
 * Accessibility: role=switch, aria-checked true when B (chain active).
 * Keyboard: Space/Enter toggles; ArrowLeft → A; ArrowRight → B.
 */

interface Props {
  /** true = bypass (A), false = chain active (B) */
  bypass: boolean;
  onToggle: () => void;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 22;
const TAB_SIZE = 18;
const TAB_PAD = 2;

export function AbSwitch({ bypass, onToggle }: Props) {
  const tabLeft = bypass ? TAB_PAD : TRACK_WIDTH - TAB_SIZE - TAB_PAD;

  return (
    <div
      role="switch"
      aria-checked={!bypass}
      aria-label={bypass ? "A — bypass (hearing original)" : "B — chain active (hearing effects)"}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        } else if (e.key === "ArrowLeft" && !bypass) {
          e.preventDefault();
          onToggle();
        } else if (e.key === "ArrowRight" && bypass) {
          e.preventDefault();
          onToggle();
        }
      }}
      className="inline-flex items-center gap-2 select-none cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--wb-amber)]"
    >
      <span
        className="workbench-label"
        style={{ color: bypass ? "var(--wb-amber)" : "var(--ink-500)" }}
      >
        A
      </span>
      <div
        className="relative border border-[color:var(--wb-line)] bg-[color:var(--ink-900)]"
        style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-[120ms] ease-out"
          style={{
            left: tabLeft,
            width: TAB_SIZE,
            height: TAB_SIZE,
            backgroundColor: bypass ? "var(--ink-500)" : "var(--wb-amber)",
            boxShadow: !bypass ? "0 0 8px var(--wb-amber-glow)" : undefined,
          }}
        />
      </div>
      <span
        className="workbench-label"
        style={{ color: bypass ? "var(--ink-500)" : "var(--wb-amber)" }}
      >
        B
      </span>
    </div>
  );
}
