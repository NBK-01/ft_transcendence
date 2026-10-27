import { cva, type VariantProps } from "class-variance-authority";
import { Avatar as AvatarPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@trans/ui/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 overflow-hidden rounded-full bg-gray-alpha-200 ring-1 ring-gray-alpha-400",
  {
    variants: {
      size: {
        xs: "size-5 text-[0.5625rem]",
        sm: "size-6 text-[0.625rem]",
        md: "size-8 text-label-12",
        lg: "size-10 text-label-14",
        xl: "size-16 text-label-20",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** First letters of the first two words: "Amina El Idrissi" → "AE". */
export function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function Avatar({
  className,
  size,
  src,
  name,
  online,
  statusLabel,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants> & {
    src?: string | null;
    /** Used for alt text and the initials fallback (the default avatar). */
    name: string;
    /** Presence dot. `undefined` hides it. */
    online?: boolean;
    /**
     * What the dot says to screen readers; "Online" or "Offline" by default.
     * Read even when the avatar itself is aria-hidden next to the name.
     */
    statusLabel?: string;
  }) {
  const { t } = useTranslation("common");
  return (
    <span className="relative inline-flex shrink-0">
      <AvatarPrimitive.Root data-slot="avatar" className={cn(avatarVariants({ size }), className)} {...props}>
        {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
        <AvatarPrimitive.Fallback
          delayMs={src ? 300 : 0}
          className="grid size-full place-items-center font-medium text-gray-900 select-none"
        >
          <span aria-hidden="true">{initialsOf(name)}</span>
          <span className="sr-only">{name}</span>
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {online !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute end-0 bottom-0 size-2.5 rounded-full ring-2 ring-background-100",
            online ? "bg-green-700" : "bg-gray-600",
          )}
        />
      )}
      {online !== undefined && (
        <span className="sr-only">{statusLabel ?? t(online ? "presence.online" : "presence.offline")}</span>
      )}
    </span>
  );
}
