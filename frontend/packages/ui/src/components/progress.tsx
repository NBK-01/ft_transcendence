import type { ReactNode } from "react";

import { cn } from "@trans/ui/lib/utils";

export type ProgressProps = {
  /** 0 to 1. */
  value: number;
  /** Accessible label for the progressbar role, e.g. "Upload progress". */
  label: string;
  /** Shown below the bar for sighted users, e.g. "42% uploaded". */
  caption?: ReactNode;
  className?: string;
};

/** A bar that fills from 0 to 1, with a caption below for sighted users. */
export function Progress({ value, label, caption, className }: ProgressProps) {
  const percent = Math.round(value * 100);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-gray-alpha-200"
      >
        <div
          className="h-full rounded-full bg-gray-1000 transition-[width] duration-150 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {caption && <p className="text-label-12 text-gray-900 tabular-nums">{caption}</p>}
    </div>
  );
}
