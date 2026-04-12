"use client";

import { useId, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
}

export const EmailField = forwardRef<HTMLInputElement, Props>(
  function EmailField({ label, error, className, id, ...rest }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={inputId} className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </Label>
        <div
          className={cn(
            "auth-field rounded-lg border border-border/70 bg-card/60 transition-all",
            error && "border-destructive/70"
          )}
        >
          <Input
            ref={ref}
            id={inputId}
            type="email"
            autoComplete="email"
            inputMode="email"
            className={cn(
              "h-11 border-none bg-transparent px-3.5 text-sm focus-visible:ring-0",
              className
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...rest}
          />
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
