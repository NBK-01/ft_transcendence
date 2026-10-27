import { Camera, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { isApiError } from "@trans/api";
import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { Avatar } from "@trans/ui/components/avatar";
import { Button } from "@trans/ui/components/button";
import { FieldError } from "@trans/ui/components/field";
import { toast } from "@trans/ui/components/toaster";

import { useDeleteAvatar, useUploadAvatar } from "./api";
import { AVATAR_TYPES, avatarError } from "./validation";

/**
 * The profile photo and its "Change photo" button. Uploads right away (no Save
 * needed), with progress; the file is checked first with the backend's own rules.
 */
export function AvatarSection({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const { t } = useTranslation("app");
  const inputId = useId();
  const upload = useUploadAvatar();
  const remove = useDeleteAvatar();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | undefined>();

  const choose = (file: File | undefined) => {
    if (!file) return;
    const problem = avatarError(file);
    setError(problem);
    if (problem) return;

    setProgress(0);
    upload.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: () => toast.success(t("profile.avatarUpdated")),
        // The backend's messages are already translated (Accept-Language).
        onError: (err) => setError(isApiError(err) && err.messages[0] ? err.messages[0] : "app:profile.errors.avatarUpload"),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} src={avatarUrl} size="xl" className="size-24 text-heading-24" />

      <div className="flex flex-col gap-2">
        {/* The real file input is visually hidden inside a button-styled label: clicking or
            pressing Enter/Space on it opens the file chooser, and its focus ring shows on the label. */}
        <Button variant="secondary" size="sm" className="w-fit" asChild>
          <label
            htmlFor={inputId}
            className="cursor-pointer has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-gray-alpha-400"
          >
            <input
              id={inputId}
              type="file"
              accept={AVATAR_TYPES.join(",")}
              className="sr-only"
              disabled={upload.isPending}
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Camera aria-hidden="true" />
            {upload.isPending
              ? t("profile.uploading", { percent: Math.round(progress * 100) })
              : avatarUrl
                ? t("profile.changePhoto")
                : t("profile.addPhoto")}
          </label>
        </Button>
        <p className="text-label-12 text-gray-900">{t("profile.photoHint")}</p>
        {error && <FieldError message={error} />}
      </div>

      {avatarUrl && (
        <ConfirmDelete
          trigger={
            <Button variant="tertiary" size="sm" prefix={<Trash2 />}>
              {t("profile.removePhoto")}
            </Button>
          }
          title={t("profile.removePhotoTitle")}
          description={t("profile.removePhotoBody")}
          errorText={t("profile.removePhotoError")}
          onConfirm={async () => {
            await remove.mutateAsync();
            toast.success(t("profile.photoRemoved"));
          }}
        />
      )}
    </div>
  );
}
