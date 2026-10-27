import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { SHIPMENT_IMAGE_TYPES } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { FieldError } from "@trans/ui/components/field";
import { cn } from "@trans/ui/lib/utils";

export const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

type Photo = { file: File; url: string };

/**
 * Pick up to 5 product photos (click or drop), with previews and remove.
 * Reports the chosen files through `onChange`; previews are revoked when removed or unmounted.
 */
export function PhotoPicker({ onChange, error }: { onChange: (files: File[]) => void; error?: string }) {
  const { t } = useTranslation("app");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [rejected, setRejected] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);

  // Every preview URL still alive; freed when removed, or all at once when the picker goes away.
  const liveUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = liveUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const preview = (file: File): Photo => {
    const url = URL.createObjectURL(file);
    liveUrls.current.add(url);
    return { file, url };
  };

  const update = (next: Photo[]) => {
    setPhotos(next);
    onChange(next.map((photo) => photo.file));
  };

  const add = (files: FileList | null) => {
    if (!files) return;
    const incoming = [...files];
    const accepted = incoming.filter(
      (file) => (SHIPMENT_IMAGE_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_PHOTO_BYTES,
    );
    const room = MAX_PHOTOS - photos.length;
    const kept = accepted.slice(0, room);

    if (accepted.length < incoming.length) setRejected("shipments.newForm.photoRejected");
    else if (accepted.length > room) setRejected("shipments.newForm.photoLimit");
    else setRejected(undefined);

    update([...photos, ...kept.map(preview)]);
  };

  const remove = (index: number) => {
    const photo = photos[index];
    if (photo) {
      URL.revokeObjectURL(photo.url);
      liveUrls.current.delete(photo.url);
    }
    setRejected(undefined);
    update(photos.filter((_, i) => i !== index));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    add(event.dataTransfer.files);
  };

  const message = error ?? (rejected ? `app:${rejected}` : undefined);

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={SHIPMENT_IMAGE_TYPES.join(",")}
        multiple
        className="sr-only"
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />

      {photos.length < MAX_PHOTOS && (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-gray-alpha-500 px-6 py-8 text-center transition-colors",
            "hover:bg-gray-alpha-100 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-gray-alpha-200",
            dragging && "border-gray-alpha-600 bg-gray-alpha-100",
          )}
        >
          <ImagePlus aria-hidden="true" className="size-6 text-gray-900" />
          <span className="text-label-14 text-gray-1000">{t("shipments.newForm.photoDrop")}</span>
          <span className="text-label-12 text-gray-900">
            {t("shipments.newForm.photoHint", { count: MAX_PHOTOS - photos.length })}
          </span>
        </label>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={photo.url} className="relative">
              <img
                src={photo.url}
                alt={photo.file.name}
                className="aspect-square w-full rounded-lg border border-gray-alpha-400 object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="tiny"
                shape="circle"
                onClick={() => remove(index)}
                aria-label={t("shipments.newForm.removePhoto", { name: photo.file.name })}
                className="absolute end-1 top-1"
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {message && <FieldError message={message} />}
    </div>
  );
}
