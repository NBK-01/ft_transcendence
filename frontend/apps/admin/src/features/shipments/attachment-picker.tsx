import { FilePlus2, FileText, ImageIcon, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import { MAX_SHIPMENT_FILE_BYTES, SHIPMENT_FILE_TYPES } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { cn } from "@trans/ui/lib/utils";

import { useDetailFormat } from "./use-detail-format";

/** Why a file can't be attached (an i18n key), or undefined when it can. */
function problemWith(file: File) {
  if (!(SHIPMENT_FILE_TYPES as readonly string[]).includes(file.type)) return "app:shipment.uploadForm.fileType";
  if (file.size > MAX_SHIPMENT_FILE_BYTES) return "app:shipment.uploadForm.fileSize";
  return undefined;
}

/**
 * One attachment (click or drop): an image or a PDF, up to 10 MB, checked
 * before anything is sent; `onReject` gets the reason (an i18n key). Inside a
 * <Field>, the id and aria attributes it hands down go to the file input.
 */
export function AttachmentPicker({
  value,
  onChange,
  onReject,
  id,
  ...aria
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  onReject: (message: string) => void;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const { t } = useTranslation("app");
  const format = useDetailFormat();
  const ownId = useId();
  const inputId = id ?? ownId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // The remove button is gone once the file is: focus the way to pick one
  // instead (enabled again by then), so focus doesn't drop to <body>.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    inputRef.current?.focus();
  }, [value]);

  const pick = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const problem = problemWith(file);
    if (problem) onReject(problem);
    else onChange(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!value) pick(event.dataTransfer.files);
  };

  const Icon = value?.type.startsWith("image/") ? ImageIcon : FileText;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={SHIPMENT_FILE_TYPES.join(",")}
        disabled={value !== null}
        className="peer sr-only"
        onChange={(event) => {
          pick(event.target.files);
          // Picking the same file again after removing it still fires a change.
          event.target.value = "";
        }}
        {...aria}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-gray-alpha-400 bg-background-200 px-3 py-2.5">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-gray-900" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-label-14 text-gray-1000">
              <bdi>{value.name}</bdi>
            </span>
            <span className="text-label-12 text-gray-900">{format.fileSize(value.size)}</span>
          </div>
          <Button
            variant="tertiary"
            size="sm"
            shape="square"
            onClick={() => {
              refocus.current = true;
              onChange(null);
            }}
            aria-label={t("shipment.uploadForm.remove", { name: value.name })}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
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
          <FilePlus2 aria-hidden="true" className="size-5 text-gray-900" />
          <span className="text-label-14 text-gray-1000">{t("shipment.uploadForm.drop")}</span>
        </label>
      )}
    </div>
  );
}
