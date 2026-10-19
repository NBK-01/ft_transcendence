import { zodResolver } from "@hookform/resolvers/zod";
import type { RefObject } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { isApiError, type Organization } from "@trans/api";
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
import { Input } from "@trans/ui/components/input";
import { Textarea } from "@trans/ui/components/textarea";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";
import { branchSchema, type BranchValues } from "@trans/ui/schemas/branch";

import { NAME_TAKEN, useCreateOrganization, useUpdateOrganization } from "./api";

/**
 * Create a branch (`branch` is null) or edit one. The form mounts with the
 * dialog's content, so it starts fresh every time the dialog opens.
 */
export function BranchFormDialog({
  open,
  onOpenChange,
  branch,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Organization | null;
  /** Element to focus when the dialog closes (needed when it opened from a menu item). */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("app");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onCloseAutoFocus={focusOnClose(returnFocusTo)}
      >
        <DialogHeader>
          <DialogTitle>
            {branch ? t("branches.form.editTitle", { name: branch.name }) : t("branches.form.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {branch ? t("branches.form.editDescription") : t("branches.form.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <BranchForm branch={branch} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function BranchForm({ branch, onDone }: { branch: Organization | null; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const create = useCreateOrganization();
  const update = useUpdateOrganization();
  const pending = create.isPending || update.isPending;
  const form = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name ?? "",
      description: branch?.description ?? "",
      contactEmail: branch?.contactEmail ?? "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ name, description, contactEmail }) => {
    try {
      if (branch) {
        // null clears a field; "" would fail the backend's email check.
        const updated = await update.mutateAsync({
          id: branch.id,
          name,
          description: description || null,
          contactEmail: contactEmail || null,
        });
        toast.success(t("app:branches.form.updated", { name: updated.name }));
      } else {
        const created = await create.mutateAsync({
          name,
          ...(description && { description }),
          ...(contactEmail && { contactEmail }),
        });
        toast.success(t("app:branches.form.created", { name: created.name }));
      }
      onDone();
    } catch (error) {
      if (isApiError(error) && error.errorCode === NAME_TAKEN) {
        form.setError("name", { message: "app:branches.form.nameTaken" }, { shouldFocus: true });
      } else {
        // Already translated: the backend's message (Accept-Language) or ours. Rendered as text.
        form.setError("root", {
          message: isApiError(error) && error.messages[0] ? error.messages[0] : t("app:branches.form.error"),
        });
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogBody className="flex flex-col gap-5">
        <Field label={t("app:branches.form.name")} error={errors.name?.message}>
          <Input autoComplete="off" autoFocus {...form.register("name")} />
        </Field>
        <Field
          label={t("app:branches.form.description")}
          hint={t("app:branches.form.optional")}
          error={errors.description?.message}
        >
          <Textarea rows={3} {...form.register("description")} />
        </Field>
        <Field
          label={t("app:branches.form.contactEmail")}
          hint={t("app:branches.form.optional")}
          error={errors.contactEmail?.message}
        >
          <Input type="email" autoComplete="off" dir="ltr" {...form.register("contactEmail")} />
        </Field>
        {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={pending}>
            {t("actions.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={pending}>
          {branch ? t("actions.save") : t("app:branches.form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
