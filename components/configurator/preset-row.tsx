"use client";

import { useState } from "react";
import { Loader2, Save, RefreshCw, Trash2, Sparkles } from "lucide-react";

import type { PresetIndex } from "@/lib/ocarina-api";

interface Props {
  builtin: PresetIndex;
  user: PresetIndex;
  isBusy: boolean;
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
  onApplyBuiltin,
  onApplyUser,
  onSaveUser,
  onDeleteUser,
  onReapply,
  onClearAll,
}: Props) {
  const [saveDraft, setSaveDraft] = useState("");
  const [showSave, setShowSave] = useState(false);

  const builtinNames = Object.keys(builtin).sort();
  const userNames = Object.keys(user).sort();

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Built-in preset
          </label>
          <select
            disabled={isBusy || builtinNames.length === 0}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                void onApplyBuiltin(e.target.value);
                e.target.value = "";
              }
            }}
            className="block w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="" disabled>
              {builtinNames.length === 0 ? "(none)" : "Apply…"}
            </option>
            {builtinNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Your presets
          </label>
          {userNames.length > 0 ? (
            <div className="flex gap-1.5">
              <select
                disabled={isBusy}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    void onApplyUser(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="block flex-1 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="" disabled>Apply…</option>
                {userNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <UserDeleteMenu
                names={userNames}
                disabled={isBusy}
                onDelete={onDeleteUser}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No saved presets yet — save the current mapping to get started.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
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
          className="mt-3 flex items-center gap-2"
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

function UserDeleteMenu({
  names,
  disabled,
  onDelete,
}: {
  names: string[];
  disabled: boolean;
  onDelete: (name: string) => Promise<void>;
}) {
  return (
    <select
      disabled={disabled}
      defaultValue=""
      onChange={(e) => {
        if (e.target.value && confirm(`Delete preset "${e.target.value}"?`)) {
          void onDelete(e.target.value);
        }
        e.target.value = "";
      }}
      className="rounded-md border border-border bg-card/50 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      title="Delete a saved preset"
    >
      <option value="" disabled>
        <Trash2 className="size-3" />
      </option>
      {names.map((n) => (
        <option key={n} value={n}>
          Delete {n}
        </option>
      ))}
    </select>
  );
}
