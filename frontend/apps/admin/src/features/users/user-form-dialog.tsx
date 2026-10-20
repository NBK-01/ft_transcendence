import { zodResolver } from "@hookform/resolvers/zod";
import type { RefObject } from "react";
import { Controller, useForm, type Control, type FieldValues, type Path } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { isApiError, isForbidden, type InternalUser } from "@trans/api";
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
import { PasswordInput } from "@trans/ui/components/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";
import {
  createStaffSchema,
  editStaffSchema,
  type CreateStaffValues,
  type EditStaffValues,
} from "@trans/ui/schemas/staff";

import { useOrganizations } from "../branches/api";
import { EMAIL_TAKEN, useCreateInternalUser, useRoles, useUpdateInternalUser } from "./api";

/**
 * The form-level error, as text (not a key): ours for a 403 (the role changed
 * since signing in), else the backend's message, else our generic one.
 */
function rootError(error: unknown, t: (key: string) => string) {
  if (isForbidden(error)) return t("app:noAccess.action");
  return isApiError(error) && error.messages[0] ? error.messages[0] : t("app:users.form.error");
}

/** Radix Select can't use "" as an item value, so this stands for "no branch". */
const NO_BRANCH = "none";

/**
 * Create a staff account (`user` is null) or edit one. The form mounts with
 * the dialog's content, so it starts fresh every time the dialog opens.
 */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: InternalUser | null;
  /** Element to focus when the dialog closes (needed when it opened from a menu item). */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("app");
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onCloseAutoFocus={focusOnClose(returnFocusTo)}
      >
        <DialogHeader>
          <DialogTitle>{user ? t("users.form.editTitle", { name: user.name }) : t("users.form.createTitle")}</DialogTitle>
          <DialogDescription>
            {user ? t("users.form.editDescription") : t("users.form.createDescription")}
          </DialogDescription>
        </DialogHeader>
        {user ? <EditStaffForm user={user} onDone={close} /> : <CreateStaffForm onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateStaffForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const create = useCreateInternalUser();
  const form = useForm<CreateStaffValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: { name: "", email: "", password: "", roleName: "", organizationId: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ organizationId, ...values }) => {
    try {
      const user = await create.mutateAsync({ ...values, ...(organizationId && { organizationId }) });
      toast.success(t("app:users.form.created", { name: user.name }));
      onDone();
    } catch (error) {
      if (isApiError(error) && error.errorCode === EMAIL_TAKEN) {
        form.setError("email", { message: "app:users.form.emailTaken" }, { shouldFocus: true });
      } else {
        form.setError("root", { message: rootError(error, t) });
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogBody className="flex flex-col gap-5">
        <Field label={t("app:users.form.name")} error={errors.name?.message}>
          <Input autoComplete="off" autoFocus {...form.register("name")} />
        </Field>
        <Field label={t("app:users.form.email")} error={errors.email?.message}>
          <Input type="email" autoComplete="off" dir="ltr" {...form.register("email")} />
        </Field>
        <Field
          label={t("app:users.form.password")}
          hint={t("app:users.form.passwordHint")}
          error={errors.password?.message}
        >
          <PasswordInput autoComplete="new-password" dir="ltr" {...form.register("password")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <RoleField control={form.control} name="roleName" error={errors.roleName?.message} />
          <BranchField control={form.control} name="organizationId" />
        </div>
        {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
      </DialogBody>
      <FormFooter submitLabel={t("app:users.form.create")} pending={create.isPending} />
    </form>
  );
}

function EditStaffForm({ user, onDone }: { user: InternalUser; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const update = useUpdateInternalUser();
  const form = useForm<EditStaffValues>({
    resolver: zodResolver(editStaffSchema),
    defaultValues: { name: user.name, roleName: user.roleName ?? "", organizationId: user.organizationId ?? "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ organizationId, ...values }) => {
    try {
      const updated = await update.mutateAsync({ id: user.id, ...values, organizationId: organizationId || null });
      toast.success(t("app:users.form.updated", { name: updated.name }));
      onDone();
    } catch (error) {
      form.setError("root", { message: rootError(error, t) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <DialogBody className="flex flex-col gap-5">
        <Field label={t("app:users.form.name")} error={errors.name?.message}>
          <Input autoComplete="off" autoFocus {...form.register("name")} />
        </Field>
        <Field label={t("app:users.form.email")} hint={t("app:users.form.emailLocked")}>
          <Input value={user.email} disabled dir="ltr" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <RoleField control={form.control} name="roleName" error={errors.roleName?.message} />
          <BranchField control={form.control} name="organizationId" />
        </div>
        {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
      </DialogBody>
      <FormFooter submitLabel={t("actions.save")} pending={update.isPending} />
    </form>
  );
}

function FormFooter({ submitLabel, pending }: { submitLabel: string; pending: boolean }) {
  const { t } = useTranslation("common");
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary" disabled={pending}>
          {t("actions.cancel")}
        </Button>
      </DialogClose>
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

/*
 * The Field sits inside <Select> around the trigger: Select's root renders no
 * element, so the label's id and the error's aria attributes land on the trigger.
 */

function RoleField<T extends FieldValues>({ control, name, error }: { control: Control<T>; name: Path<T>; error?: string }) {
  const { t } = useTranslation("app");
  const roles = useRoles();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
          <Field label={t("users.form.role")} error={error}>
            <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
              <SelectValue placeholder={t("users.form.rolePlaceholder")} />
            </SelectTrigger>
          </Field>
          <SelectContent>
            {(roles.data ?? []).map((role) => (
              <SelectItem key={role.id} value={role.name}>
                {t(`users.roles.${role.name}`, { defaultValue: role.name })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

function BranchField<T extends FieldValues>({ control, name }: { control: Control<T>; name: Path<T> }) {
  const { t } = useTranslation("app");
  const organizations = useOrganizations();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={(field.value as string) || NO_BRANCH}
          onValueChange={(value) => field.onChange(value === NO_BRANCH ? "" : value)}
        >
          <Field label={t("users.form.branch")}>
            <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
              <SelectValue />
            </SelectTrigger>
          </Field>
          <SelectContent>
            <SelectItem value={NO_BRANCH}>{t("users.noBranch")}</SelectItem>
            {/* Inactive branches only show when they're the current value, so editing doesn't drop it. */}
            {(organizations.data ?? [])
              .filter((org) => org.isActive || org.id === field.value)
              .map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
