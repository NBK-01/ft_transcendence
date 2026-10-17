import { useState, type FormEvent, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@trans/ui/components/alert-dialog";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";

export type ConfirmDeleteProps = {
  /** Element that opens the dialog. Leave it out and use `open`/`onOpenChange` (e.g. from a table row action). */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  /** When set, the user has to type this exactly (e.g. an email or branch name) before deleting. */
  confirmText?: string;
  /** Defaults to "Delete". */
  actionLabel?: ReactNode;
  /** May return a promise: the dialog waits, closes on success, and stays open with an error on failure. */
  onConfirm: () => void | Promise<unknown>;
};

/** Destructive confirmation on top of AlertDialog, optionally with type-to-confirm. */
export function ConfirmDelete({
  trigger,
  open: openProp,
  onOpenChange,
  title,
  description,
  confirmText,
  actionLabel,
  onConfirm,
}: ConfirmDeleteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const open = openProp ?? internalOpen;

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent
        // With type-to-confirm, start in the input instead of on Cancel.
        onOpenAutoFocus={confirmText !== undefined ? (event) => event.preventDefault() : undefined}
      >
        {/* Mounted only while open, so the typed text and error reset on every open. */}
        <ConfirmDeleteForm
          title={title}
          description={description}
          confirmText={confirmText}
          actionLabel={actionLabel}
          pending={pending}
          onSubmit={async () => {
            setPending(true);
            try {
              await onConfirm();
              setPending(false);
              setOpen(false);
              return true;
            } catch {
              setPending(false);
              return false;
            }
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmDeleteForm({
  title,
  description,
  confirmText,
  actionLabel,
  pending,
  onSubmit,
}: Pick<ConfirmDeleteProps, "title" | "description" | "confirmText" | "actionLabel"> & {
  pending: boolean;
  onSubmit: () => Promise<boolean>;
}) {
  const { t } = useTranslation("common");
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);
  const matches = confirmText === undefined || typed.trim() === confirmText;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!matches || pending) return;
    setFailed(false);
    setFailed(!(await onSubmit()));
  };

  return (
    <form onSubmit={handleSubmit}>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>

      {(confirmText !== undefined || failed) && (
        <div className="flex flex-col gap-3 px-6 pb-6">
          {confirmText !== undefined && (
            <Field
              label={
                <span>
                  <Trans
                    t={t}
                    i18nKey="confirmDelete.typeToConfirm"
                    values={{ value: confirmText }}
                    components={{ value: <span className="text-label-mono-13 text-gray-1000" dir="auto" /> }}
                  />
                </span>
              }
            >
              <Input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={pending}
                dir="auto"
              />
            </Field>
          )}
          {failed && <FieldError message="confirmDelete.error" />}
        </div>
      )}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{t("actions.cancel")}</AlertDialogCancel>
        <Button type="submit" variant="error" disabled={!matches} loading={pending}>
          {actionLabel ?? t("actions.delete")}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
