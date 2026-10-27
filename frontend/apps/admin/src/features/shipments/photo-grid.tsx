import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ImageRef } from "@trans/api";

/**
 * Request or offer photos: thumbnails that open the full photo in a new tab.
 * `renderAction`, when given, overlays its result (e.g. a delete button) on
 * each thumbnail — used for offer photos, never for the client's own request photos.
 */
export function PhotoGrid({ images, renderAction }: { images: ImageRef[]; renderAction?: (image: ImageRef) => ReactNode }) {
  const { t } = useTranslation("app");
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {images.map((image) => (
        <li key={image.id} className="relative">
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring block overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-200"
          >
            {/* The file name is all the API knows about a photo, so it's the best alt there is. */}
            <img
              src={image.url}
              alt={image.name}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-opacity duration-150 hover:opacity-85"
            />
            <span className="sr-only">{t("shipment.newTab")}</span>
          </a>
          {renderAction && <div className="absolute end-1 top-1">{renderAction(image)}</div>}
        </li>
      ))}
    </ul>
  );
}
