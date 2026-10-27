import { Camera, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar } from "@trans/ui/components/avatar";
import { Button } from "@trans/ui/components/button";
import { FieldError } from "@trans/ui/components/field";
import { cn } from "@trans/ui/lib/utils";

/** The backend's rules for profile photos (FileStorageService): JPEG, PNG or WebP, up to 2 MB. */
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type AvatarUploaderProps = {
  name: string;
  src?: string | null;
  /** 0 to 1 while a photo is going up; leave it out otherwise. */
  progress?: number;
  /** While the photo is being removed. */
  removing?: boolean;
  /** Why the last upload or removal failed, already translated (the backend's message, say). */
  error?: string;
  /** A file that passed the type and size checks. Upload it straight away: there's no Save. */
  onSelect: (file: File) => void;
  /** Shows "Remove photo" while there's a photo. */
  onRemove?: () => void;
  accept?: readonly string[];
  maxBytes?: number;
};

/**
 * A profile photo with "Change photo" and "Remove photo". Checks the file's
 * type and size before handing it over, and shows the upload's progress on
 * the button. The parent uploads it.
 */
export function AvatarUploader({
  name,
  src,
  progress,
  removing = false,
  error,
  onSelect,
  onRemove,
  accept = PHOTO_TYPES,
  maxBytes = PHOTO_MAX_BYTES,
}: AvatarUploaderProps) {
  const { t, i18n } = useTranslation("common");
  const inputId = useId();
  const [problem, setProblem] = useState<string>();
  const uploading = progress !== undefined;
  const size = new Intl.NumberFormat(`${i18n.language}-u-nu-latn`, { maximumFractionDigits: 1 }).format(
    maxBytes / (1024 * 1024),
  );

  const choose = (file: File | undefined) => {
    if (!file) return;
    const next = !accept.includes(file.type)
      ? t("avatarUploader.type")
      : file.size > maxBytes
        ? t("avatarUploader.size", { size })
        : undefined;
    setProblem(next);
    if (!next) onSelect(file);
  };
  const shown = problem ?? error;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} src={src} size="xl" className="size-24 text-heading-24" />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {/* The file input is visually hidden inside a button-styled label: clicking it, or
              Enter/Space on the focused input, opens the file chooser; the label shows the focus ring. */}
          <Button variant="secondary" size="sm" className="w-fit" asChild>
            <label
              htmlFor={inputId}
              className={cn(
                "cursor-pointer has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-gray-alpha-400",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              )}
            >
              <input
                id={inputId}
                type="file"
                accept={accept.join(",")}
                className="sr-only"
                disabled={uploading || removing}
                onChange={(event) => {
                  choose(event.target.files?.[0]);
                  // The same file again still fires a change.
                  event.target.value = "";
                }}
              />
              <Camera aria-hidden="true" />
              {uploading
                ? t("avatarUploader.uploading", { percent: Math.round(progress * 100) })
                : t(src ? "avatarUploader.change" : "avatarUploader.add")}
            </label>
          </Button>
          {src && onRemove && (
            <Button
              variant="tertiary"
              size="sm"
              prefix={<Trash2 />}
              loading={removing}
              disabled={uploading}
              onClick={() => {
                setProblem(undefined);
                onRemove();
              }}
            >
              {t("avatarUploader.remove")}
            </Button>
          )}
        </div>
        <p className="text-label-12 text-gray-900">{t("avatarUploader.hint", { size })}</p>
        {shown && <FieldError>{shown}</FieldError>}
      </div>
    </div>
  );
}
