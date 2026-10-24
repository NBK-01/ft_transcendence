import { ImagePlus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { MAX_OFFER_IMAGES, MAX_SHIPMENT_FILE_BYTES, SHIPMENT_IMAGE_TYPES } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { cn } from "@trans/ui/lib/utils";

const isAllowed = (file: File) =>
  (SHIPMENT_IMAGE_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_SHIPMENT_FILE_BYTES;

/**
 * Up to MAX_OFFER_IMAGES supplier photos (click or drop), with previews and
 * remove. Files of the wrong type or size, or past the limit, are left out
 * before anything is sent, and `onReject` gets the reason (an i18n key).
 * Inside a <Field>, the id and aria attributes it hands down go to the file input.
 */
export function OfferPhotoPicker({
  value,
  onChange,
  onReject,
  id,
  ...aria
}: {
  value: File[];
  onChange: (files: File[]) => void;
  onReject: (message: string) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const { t } = useTranslation("app");
  const ownId = useId();
  const inputId = id ?? ownId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const previews = usePreviews(value);
  const full = value.length >= MAX_OFFER_IMAGES;

  // A photo's remove button is gone once it's removed: focus the way to add one
  // instead (enabled again by then), so focus doesn't drop to <body>.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    inputRef.current?.focus();
  }, [value]);

  const add = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = [...list];
    const allowed = incoming.filter(isAllowed);
    const room = MAX_OFFER_IMAGES - value.length;
    onChange([...value, ...allowed.slice(0, room)]);
    if (allowed.length < incoming.length) onReject("app:shipment.offerForm.photoRejected");
    else if (allowed.length > room) onReject("app:shipment.offerForm.photoLimit");
  };

  const remove = (file: File) => {
    refocus.current = true;
    onChange(value.filter((candidate) => candidate !== file));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!full) add(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={SHIPMENT_IMAGE_TYPES.join(",")}
        multiple
        disabled={full}
        className="peer sr-only"
        onChange={(event) => {
          add(event.target.files);
          // Picking the same file again after removing it still fires a change.
          event.target.value = "";
        }}
        {...aria}
      />

      {!full && (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-gray-alpha-500",
            "px-4 py-5 text-center transition-colors duration-150 hover:bg-gray-alpha-100",
            // The input just before (its `peer`) is visually hidden: its focus ring shows here, like `focus-ring`.
            "peer-focus-visible:shadow-[0_0_0_2px_var(--background-100),0_0_0_4px_var(--orange-800)]",
            dragging && "border-gray-alpha-600 bg-gray-alpha-100",
          )}
        >
          <ImagePlus aria-hidden="true" className="size-5 text-gray-900" />
          <span className="text-label-14 text-gray-1000">{t("shipment.offerForm.photoDrop")}</span>
        </label>
      )}

      {previews.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map(({ file, url }) => (
            <li key={url} className="relative">
              <img
                src={url}
                alt={file.name}
                className="aspect-square w-full rounded-lg border border-gray-alpha-400 bg-background-200 object-cover"
              />
              <Button
                variant="secondary"
                size="tiny"
                shape="circle"
                onClick={() => remove(file)}
                aria-label={t("shipment.offerForm.removePhoto", { name: file.name })}
                className="absolute end-1 top-1"
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A preview URL per file, freed once the files change or the picker goes away. */
function usePreviews(files: File[]) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  return previews;
}
