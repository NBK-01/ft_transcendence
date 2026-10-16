import { cn } from "@trans/ui/lib/utils";

import type { ImageRef } from "./types";

/** Thumbnails for request and offer photos. */
export function ImageGrid({ images, className }: { images: ImageRef[]; className?: string }) {
  if (images.length === 0) return null;
  return (
    <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)}>
      {images.map((image) => (
        <li key={image.id}>
          <img
            src={image.url}
            alt={image.name}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-lg border border-gray-alpha-400 bg-background-200 object-cover"
          />
        </li>
      ))}
    </ul>
  );
}
