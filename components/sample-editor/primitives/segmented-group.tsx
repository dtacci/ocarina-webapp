"use client";

/**
 * Workbench SegmentedGroup — chunky LED-on segments.
 *
 * Used for small closed enums (filter mode hp/lp/bp, fade curve, etc).
 * Active segment gets amber text + amber bottom-border + filled LED dot.
 */

export interface SegmentedGroupProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string }[];
  label?: string;
  onChange: (value: T) => void;
}

export function SegmentedGroup<T extends string>({
  value,
  options,
  label,
  onChange,
}: SegmentedGroupProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="workbench-label">{label}</span>}
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex border border-[color:var(--wb-line)] bg-[color:var(--ink-800)] divide-x divide-[color:var(--wb-line-soft)]"
      >
        {options.map((o) => {
          const isActive = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(o.value)}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 workbench-label transition-colors hover:text-[color:var(--ink-300)]"
              style={{
                color: isActive ? "var(--wb-amber)" : "var(--ink-500)",
                borderBottom: `2px solid ${isActive ? "var(--wb-amber)" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              <span className="workbench-led" data-on={isActive} />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
