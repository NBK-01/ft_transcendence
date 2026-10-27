import type { ReactNode } from "react";

import { cn } from "@trans/ui/lib/utils";

import type { ImageRef } from "./types";

/**
 * Thumbnails for request and offer photos. `renderAction`, when given,
 * overlays its result (e.g. a remove button) on each thumbnail — used for
 * the client's own request photos only, never for the supplier's offer photos.
 */
export function ImageGrid({
  images,
  className,
  renderAction,
}: {
  images: ImageRef[];
  className?: string;
  renderAction?: (image: ImageRef) => ReactNode;
}) {
  if (images.length === 0) return null;
  return (
    <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)}>
      {images.map((image) => (
        <li key={image.id} className="relative">
          <img
            src={image.url}
            alt={image.name}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-lg border border-gray-alpha-400 bg-background-200 object-cover"
          />
          {renderAction && <div className="absolute end-1 top-1">{renderAction(image)}</div>}
        </li>
      ))}
    </ul>
  );
}
