"use client";

/**
 * Workbench Dropdown — skinned native <select>.
 *
 * We wrap instead of reinventing so keyboard behavior, screen readers, and
 * mobile pickers all work natively. A custom caret replaces the browser
 * default; the rest is mono type on workbench colors.
 */

import { useId } from "react";
import { ChevronDown } from "lucide-react";

export interface DropdownProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  label?: string;
  onChange: (value: T) => void;
}

export function Dropdown<T extends string>({
  value,
  options,
  label,
  onChange,
}: DropdownProps<T>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="workbench-label">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="appearance-none workbench-readout text-xs pl-2 pr-6 py-1.5 border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] text-[color:var(--ink-200)] hover:border-[color:var(--ink-500)] focus:border-[color:var(--wb-amber-dim)] focus:outline-none cursor-pointer lowercase min-w-[110px]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="size-3 absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--ink-500)] pointer-events-none"
        />
      </div>
    </div>
  );
}
