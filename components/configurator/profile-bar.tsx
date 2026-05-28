"use client";

import { useState } from "react";
import { Copy, Trash2, Plus } from "lucide-react";

import type { ButtonProfile } from "@/lib/config/default-config";

interface Props {
  profiles: Record<string, ButtonProfile>;
  activeId: string;
  onActiveChange: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProfileBar({
  profiles,
  activeId,
  onActiveChange,
  onRename,
  onDuplicate,
  onDelete,
}: Props) {
  const profileIds = Object.keys(profiles);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const active = profiles[activeId];

  function startRename() {
    setDraftName(active?.name ?? activeId);
    setRenaming(true);
  }

  function commitRename() {
    if (draftName.trim()) onRename(activeId, draftName.trim());
    setRenaming(false);
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Active profile
          </p>
          {renaming ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <button
              type="button"
              onClick={startRename}
              className="mt-1 text-sm font-medium hover:underline"
              title="Click to rename"
            >
              {active?.name ?? activeId}
            </button>
          )}
        </div>

        <select
          value={activeId}
          onChange={(e) => onActiveChange(e.target.value)}
          className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {profileIds.map((id) => (
            <option key={id} value={id}>
              {profiles[id].name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onDuplicate(activeId)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Duplicate this profile"
        >
          <Copy className="size-3" />
          Duplicate
        </button>

        <button
          type="button"
          onClick={() => onDelete(activeId)}
          disabled={profileIds.length <= 1}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title={
            profileIds.length <= 1
              ? "Can't delete the last profile"
              : "Delete this profile"
          }
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Plus className="size-3" />
        <span>
          Click a button below to override it for this profile. Switch profiles
          from the dropdown to compare layouts.
        </span>
      </div>
    </div>
  );
}
