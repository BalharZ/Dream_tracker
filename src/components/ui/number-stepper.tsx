import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface NumberStepperProps {
  /** Current value. Empty string is allowed so the field can be cleared while typing. */
  value: number | string;
  /** Emits a number, or "" while the field is being cleared/typed. */
  onChange: (value: number | string) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  "aria-label"?: string;
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  placeholder = "0",
  className,
  inputClassName,
  buttonClassName,
  ...rest
}: NumberStepperProps) {
  const clamp = (n: number) => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };

  const current =
    value === "" || value === null || value === undefined ? NaN : Number(value);

  const adjust = (delta: number) => {
    const base = Number.isNaN(current) ? (min ?? 0) : current;
    onChange(clamp(base + delta));
  };

  return (
    <div className={cn("flex items-stretch gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        tabIndex={-1}
        disabled={disabled || (min !== undefined && !Number.isNaN(current) && current <= min)}
        onClick={() => adjust(-step)}
        aria-label="Decrease"
        className={cn("shrink-0", buttonClassName)}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Input
        type="text"
        inputMode="decimal"
        value={value === null || value === undefined ? "" : String(value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("text-center", inputClassName)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          // Allow only an optional sign, digits and a single decimal separator.
          if (!/^-?\d*[.,]?\d*$/.test(raw)) return;
          // Keep partial input (trailing separator / lone sign) as a string so
          // the user can keep typing decimals.
          if (/[.,]$/.test(raw) || raw === "-") {
            onChange(raw);
            return;
          }
          const num = parseFloat(raw.replace(",", "."));
          onChange(Number.isNaN(num) ? "" : num);
        }}
        onBlur={() => {
          if (value === "" || Number.isNaN(current)) return;
          const clamped = clamp(current);
          if (clamped !== current) onChange(clamped);
        }}
        {...rest}
      />

      <Button
        type="button"
        variant="outline"
        size="icon"
        tabIndex={-1}
        disabled={disabled || (max !== undefined && !Number.isNaN(current) && current >= max)}
        onClick={() => adjust(step)}
        aria-label="Increase"
        className={cn("shrink-0", buttonClassName)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
