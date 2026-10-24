import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type RefObject } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  ATTACHMENT_KINDS,
  FILE_TOO_LARGE,
  INVALID_FILE_TYPE,
  isApiError,
  useUploadShipmentFile,
} from "@trans/api";
import { Button } from "@trans/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trans/ui/components/dialog";
import { Field, FieldError } from "@trans/ui/components/field";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";

import { actionError } from "./action-error";
import { AttachmentPicker } from "./attachment-picker";
import { ChoiceList } from "./choice-list";
import { uploadSchema, type UploadInput, type UploadValues } from "./schemas";

/** The file problems the backend reports with a code: shown on the file, not the whole form. */
const FILE_ERRORS: Record<number, string> = {
  [INVALID_FILE_TYPE]: "app:shipment.uploadForm.fileType",
  [FILE_TOO_LARGE]: "app:shipment.uploadForm.fileSize",
};

/**
 * Adds a package photo, a proof of delivery or another file to the shipment,
 * in any status; the customer sees it in their Files tab. Shows the upload's
 * progress. The form mounts with the dialog's content, so it starts fresh every time it opens.
 */
export function UploadFileDialog({
  open,
  onOpenChange,
  trackingId,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("app");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg" onCloseAutoFocus={focusOnClose(returnFocusTo)}>
        <DialogHeader>
          <DialogTitle>{t("shipment.uploadForm.title")}</DialogTitle>
          <DialogDescription>{t("shipment.uploadForm.description")}</DialogDescription>
        </DialogHeader>
        <UploadForm trackingId={trackingId} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({ trackingId, onDone }: { trackingId: string; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const upload = useUploadShipmentFile();
  // 0 to 1 while the file is sent; null otherwise.
  const [progress, setProgress] = useState<number | null>(null);
  const form = useForm<UploadInput, unknown, UploadValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { kind: "", file: null },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ kind, file }) => {
    setProgress(0);
    try {
      const saved = await upload.mutateAsync({ trackingId, kind, file, onProgress: setProgress });
      toast.success(t("app:shipment.uploadForm.uploaded", { name: saved.name }));
      onDone();
    } catch (error) {
      const fileError = isApiError(error) && error.errorCode !== undefined ? FILE_ERRORS[error.errorCode] : undefined;
      if (fileError) form.setError("file", { message: fileError });
      else form.setError("root", { message: actionError(error, t, "app:shipment.uploadForm.error") });
    } finally {
      setProgress(null);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogBody className="flex min-h-0 flex-col gap-5 overflow-y-auto">
        <ChoiceList
          legend={t("app:shipment.uploadForm.kind")}
          choices={ATTACHMENT_KINDS.map((kind) => ({
            value: kind,
            label: t(`app:shipment.files.kind.${kind}`),
            hint: t(`app:shipment.uploadForm.kindHints.${kind}`),
          }))}
          error={errors.kind?.message}
          autoFocus
          {...form.register("kind")}
        />
        <Controller
          control={form.control}
          name="file"
          render={({ field }) => (
            <Field
              label={t("app:shipment.uploadForm.file")}
              hint={t("app:shipment.uploadForm.fileHint")}
              error={errors.file?.message}
            >
              <AttachmentPicker
                value={field.value}
                onChange={(file) => {
                  field.onChange(file);
                  form.clearErrors("file");
                }}
                onReject={(message) => form.setError("file", { message })}
              />
            </Field>
          )}
        />
        {progress !== null && <UploadProgress fraction={progress} />}
        {errors.root?.message && <FieldError className="whitespace-pre-line">{errors.root.message}</FieldError>}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={upload.isPending}>
            {t("actions.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={upload.isPending}>
          {t("app:shipment.uploadForm.upload")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A bar that fills from the reading side, and the percentage in words for everyone. */
function UploadProgress({ fraction }: { fraction: number }) {
  const { t, i18n } = useTranslation("app");
  const percent = new Intl.NumberFormat(`${i18n.language}-u-nu-latn`, { style: "percent" }).format(fraction);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={t("shipment.uploadForm.progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuetext={percent}
        className="h-1.5 overflow-hidden rounded-full bg-gray-alpha-200"
      >
        <div
          className="h-full rounded-full bg-gray-1000 transition-[width] duration-150 ease-out"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <p className="text-label-12 text-gray-900 tabular-nums">{t("shipment.uploadForm.uploading", { percent })}</p>
    </div>
  );
}
