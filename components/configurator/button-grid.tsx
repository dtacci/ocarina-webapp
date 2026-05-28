"use client";

import {
  NOTE_BUTTONS,
  LATCHING_BUTTONS,
  type ButtonDef,
} from "@/lib/hardware/button-layout";
import {
  actionDef,
  describeAction,
  type ButtonAction,
} from "@/lib/config/button-actions";

import { ActionPickerPopover } from "@/components/configurator/action-picker-popover";

interface Props {
  /** Mapping from the active profile (read-only baseline). */
  baseMapping: Record<string, ButtonAction>;
  /** Per-button overrides that win over the baseline. */
  overrides: Record<string, ButtonAction>;
  onAssign: (buttonId: string, action: ButtonAction) => void;
  onClearOverride: (buttonId: string) => void;
}

/**
 * Visual remap surface. The Pi GPIO row is intentionally excluded — those
 * buttons have fixed firmware meaning (instrument browser / voice trigger).
 */
export function ButtonGrid({
  baseMapping,
  overrides,
  onAssign,
  onClearOverride,
}: Props) {
  return (
    <div className="space-y-4">
      <ButtonRow
        title="Notes row"
        buttons={NOTE_BUTTONS}
        baseMapping={baseMapping}
        overrides={overrides}
        onAssign={onAssign}
        onClearOverride={onClearOverride}
      />
      <ButtonRow
        title="Latching controls"
        buttons={LATCHING_BUTTONS}
        baseMapping={baseMapping}
        overrides={overrides}
        onAssign={onAssign}
        onClearOverride={onClearOverride}
      />
    </div>
  );
}

function ButtonRow({
  title,
  buttons,
  baseMapping,
  overrides,
  onAssign,
  onClearOverride,
}: {
  title: string;
  buttons: ButtonDef[];
} & Pick<Props, "baseMapping" | "overrides" | "onAssign" | "onClearOverride">) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {buttons.map((btn) => {
          const override = overrides[btn.id];
          const base = baseMapping[btn.id] ?? { action: "nop" as const };
          const effective: ButtonAction = override ?? base;
          const def = actionDef(effective.action);
          const overridden = Boolean(override);

          return (
            <ActionPickerPopover
              key={btn.id}
              effective={effective}
              hasOverride={overridden}
              onAssign={(a) => onAssign(btn.id, a)}
              onClearOverride={() => onClearOverride(btn.id)}
            >
              <button
                type="button"
                className={[
                  "relative flex h-20 flex-col items-stretch justify-between rounded-lg border px-2 py-1.5 text-left transition-colors",
                  def.color,
                  "hover:border-foreground/40",
                ].join(" ")}
                title={`${btn.label}${btn.sublabel ? ` · ${btn.sublabel}` : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-foreground/90">
                    {btn.label}
                  </span>
                  {overridden && (
                    <span
                      className="size-1.5 rounded-full bg-amber-400"
                      title="overridden"
                    />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider opacity-80">
                    {def.label}
                  </div>
                  <div className="truncate text-[10px] text-foreground/70">
                    {describeAction(effective)}
                  </div>
                </div>
                {btn.sublabel && (
                  <span className="absolute right-1 top-1 font-mono text-[9px] text-muted-foreground/60">
                    {btn.sublabel.replace(/^pin /, "")}
                  </span>
                )}
              </button>
            </ActionPickerPopover>
          );
        })}
      </div>
    </div>
  );
}
