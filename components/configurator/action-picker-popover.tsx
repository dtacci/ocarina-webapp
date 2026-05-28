"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ACTION_DEFS,
  actionDef,
  type ActionKind,
  type ButtonAction,
} from "@/lib/config/button-actions";

interface Props {
  /** The action currently in effect (profile + override merged). */
  effective: ButtonAction;
  /** True when this button has an override on top of the profile. */
  hasOverride: boolean;
  onAssign: (action: ButtonAction) => void;
  onClearOverride: () => void;
  children: React.ReactNode;
}

export function ActionPickerPopover({
  effective,
  hasOverride,
  onAssign,
  onClearOverride,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ActionKind>(effective.action);
  const [paramValue, setParamValue] = useState<string>(currentParam(effective));

  function handleOpenChange(next: boolean) {
    if (next) {
      setKind(effective.action);
      setParamValue(currentParam(effective));
    }
    setOpen(next);
  }

  function handleApply() {
    const def = actionDef(kind);
    const next = buildAction(kind, def.param?.key, paramValue);
    onAssign(next);
    setOpen(false);
  }

  function handleClear() {
    onClearOverride();
    setOpen(false);
  }

  const def = actionDef(kind);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Assign action</p>
            <p className="text-xs text-muted-foreground">
              Overrides the active profile for just this button.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Action
            </label>
            <select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as ActionKind;
                setKind(k);
                const next = actionDef(k);
                setParamValue(
                  next.param?.options?.[0]
                    ? String(next.param.options[0].value)
                    : ""
                );
              }}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ACTION_DEFS.map((d) => (
                <option key={d.kind} value={d.kind}>
                  {d.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">{def.description}</p>
          </div>

          {def.param && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {def.param.label}
              </label>
              {def.param.options ? (
                <select
                  value={paramValue}
                  onChange={(e) => setParamValue(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {def.param.options.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={def.param.type === "number" ? "number" : "text"}
                  value={paramValue}
                  onChange={(e) => setParamValue(e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {hasOverride ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
                Clear override
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/25"
            >
              <Check className="size-3" />
              Assign
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function currentParam(a: ButtonAction): string {
  switch (a.action) {
    case "note":          return a.note;
    case "track_select":  return String(a.track);
    case "expression":    return a.param;
    default:              return "";
  }
}

function buildAction(
  kind: ActionKind,
  paramKey: string | undefined,
  paramValue: string
): ButtonAction {
  switch (kind) {
    case "note":
      return { action: "note", note: paramValue || "C" };
    case "track_select":
      return { action: "track_select", track: Number(paramValue) || 1 };
    case "expression":
      return { action: "expression", param: paramValue || "volume_up" };
    case "mute":          return { action: "mute" };
    case "octave_up":     return { action: "octave_up" };
    case "octave_down":   return { action: "octave_down" };
    case "record":        return { action: "record" };
    case "mic_toggle":    return { action: "mic_toggle" };
    case "nop":           return { action: "nop" };
  }
  // Exhaustive — kind covered above.
  void paramKey;
  return { action: "nop" };
}
