"use client";

import { useState } from "react";
import { Loader2, Save, RefreshCw, Trash2, Sparkles } from "lucide-react";

import type { ButtonState, PresetIndex } from "@/lib/ocarina-api";
import { PresetSwatchMenu } from "@/components/configurator/preset-swatch-menu";
import { PresetDiffPopover } from "@/components/configurator/preset-diff-popover";

interface Props {
  builtin: PresetIndex;
  user: PresetIndex;
  isBusy: boolean;
  currentButtons: ButtonState[];
  onApplyBuiltin: (name: string) => Promise<void>;
  onApplyUser: (name: string) => Promise<void>;
  onSaveUser: (name: string) => Promise<void>;
  onDeleteUser: (name: string) => Promise<void>;
  onReapply: () => Promise<void>;
  onClearAll: () => Promise<void>;
}

export function PresetRow({
  builtin,
  user,
  isBusy,
  currentButtons,
  onApplyBuiltin,
  onApplyUser,
  onSaveUser,
  onDeleteUser,
  onReapply,
  onClearAll,
}: Props) {
  const [saveDraft, setSaveDraft] = useState("");
  const [showSave, setShowSave] = useState(false);

  const userNames = Object.keys(user);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 space-y-1 sm:min-w-[14rem]">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Built-in preset
          </label>
          <PresetSwatchMenu
            label="Apply preset…"
            presets={builtin}
            source="builtin"
            disabled={isBusy}
            onApply={(name) => { void onApplyBuiltin(name); }}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1 sm:min-w-[14rem]">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Your presets
          </label>
          {userNames.length > 0 ? (
            <PresetSwatchMenu
              label="Apply your preset…"
              presets={user}
              source="user"
              disabled={isBusy}
              onApply={(name) => { void onApplyUser(name); }}
              trailingAction={(name) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete preset "${name}"?`)) {
                      void onDeleteUser(name);
                    }
                  }}
                  className="rounded-md border border-border bg-card/50 px-2 py-1 text-[10px] text-muted-foreground hover:border-red-400/50 hover:text-red-300"
                  title="Delete this preset"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No saved presets yet — save the current mapping to get started.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <PresetDiffPopover
            builtin={builtin}
            user={user}
            currentButtons={currentButtons}
            disabled={isBusy || currentButtons.length === 0}
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setShowSave((s) => !s)}
            className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-3" />
            Save current as…
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => { void onReapply(); }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            title="Re-push the most-recently saved mapping (useful after a firmware reflash)"
          >
            <RefreshCw className="size-3" />
            Reapply saved
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => { void onClearAll(); }}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="size-3" />
            Clear overrides
          </button>
        </div>
      </div>

      {showSave && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = saveDraft.trim();
            if (!name) return;
            void onSaveUser(name).then(() => {
              setSaveDraft("");
              setShowSave(false);
            });
          }}
        >
          <input
            autoFocus
            value={saveDraft}
            onChange={(e) => setSaveDraft(e.target.value)}
            placeholder="preset name"
            className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!saveDraft.trim() || isBusy}
            className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            Save
          </button>
          <button
            type="button"
            onClick={() => { setShowSave(false); setSaveDraft(""); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

