import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  isApiError,
  isForbidden,
  useRemoveStaffAvatar,
  useStaffMe,
  useUpdateStaffProfile,
  useUploadStaffAvatar,
  type StaffMe,
} from "@trans/api";
import { AvatarUploader } from "@trans/ui/blocks/avatar-uploader";
import { Button } from "@trans/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@trans/ui/components/card";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { Separator } from "@trans/ui/components/separator";
import { Skeleton } from "@trans/ui/components/skeleton";
import { toast } from "@trans/ui/components/toaster";
import { staffProfileSchema, type StaffProfileValues } from "@trans/ui/schemas/staff";

import { useBranchFilter } from "../branches/use-branch-filter";

/**
 * Your account as it is now (GET /staff-auth/me): your name and photo, which
 * you change here, and your email, role and branch, which only an admin does.
 */
export function AccountCard() {
  const { t } = useTranslation(["common", "app"]);
  const me = useStaffMe();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("app:profile.accountTitle")}</CardTitle>
        <CardDescription>{t("app:profile.accountDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {me.isPending ? (
          <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">{t("table.loading")}</span>
            <div className="flex items-center gap-5">
              <Skeleton className="size-24 rounded-full" />
              <Skeleton className="h-8 w-36" />
            </div>
            <Skeleton className="h-16 w-full max-w-sm" />
          </div>
        ) : me.isError ? (
          <div className="flex flex-col items-start gap-3">
            <FieldError message="app:profile.loadError" />
            <Button variant="secondary" size="sm" onClick={() => void me.refetch()}>
              {t("table.retry")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Photo me={me.data} />
            <NameForm name={me.data.name} />
            <Separator />
            <Details me={me.data} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** POST and DELETE /staff-profile/avatar: they apply at once, with no Save. */
function Photo({ me }: { me: StaffMe }) {
  const { t } = useTranslation("app");
  const upload = useUploadStaffAvatar();
  const remove = useRemoveStaffAvatar();
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();

  const choose = (file: File) => {
    setError(undefined);
    setProgress(0);
    upload.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: () => toast.success(t("profile.photoUpdated")),
        // The backend's messages are already translated (Accept-Language).
        onError: (err) => setError(isApiError(err) && err.messages[0] ? err.messages[0] : t("profile.photoError")),
        onSettled: () => setProgress(undefined),
      },
    );
  };
  const clear = () => {
    setError(undefined);
    remove.mutate(undefined, {
      onSuccess: () => toast.success(t("profile.photoRemoved")),
      onError: () => setError(t("profile.photoRemoveError")),
    });
  };

  return (
    <AvatarUploader
      name={me.name}
      src={me.avatarUrl}
      progress={progress}
      removing={remove.isPending}
      error={error}
      onSelect={choose}
      onRemove={clear}
    />
  );
}

/** PATCH /staff-profile. The new name shows everywhere at once (the shell, chat, contacts). */
function NameForm({ name }: { name: string }) {
  const { t } = useTranslation(["common", "app"]);
  const rename = useUpdateStaffProfile();
  const form = useForm<StaffProfileValues>({
    resolver: zodResolver(staffProfileSchema),
    // Follows /me if it changes elsewhere, without losing what's being typed.
    values: { name },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isDirty } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      const me = await rename.mutateAsync(values);
      form.reset({ name: me.name });
      toast.success(t("app:profile.nameSaved"));
    } catch (error) {
      form.setError("root", { message: isForbidden(error) ? "app:noAccess.action" : "app:profile.nameError" });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex max-w-sm flex-col gap-3">
      <Field label={t("app:profile.name")} error={errors.name?.message}>
        <Input autoComplete="name" {...form.register("name")} />
      </Field>
      {errors.root?.message && <FieldError message={errors.root.message} />}
      <Button type="submit" size="sm" className="w-fit" loading={rename.isPending} disabled={!isDirty}>
        {t("actions.save")}
      </Button>
    </form>
  );
}

function Details({ me }: { me: StaffMe }) {
  const { t } = useTranslation("app");
  const { withBranch } = useBranchFilter();
  const role = me.roleName ?? "none";

  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      <Row label={t("profile.email")} value={<span dir="ltr">{me.email}</span>} />
      <Row label={t("profile.role")} value={t(`users.roles.${role}`, { defaultValue: role })} />
      <Row
        label={t("profile.branch")}
        value={
          me.organization ? (
            <Link
              to={withBranch(`/branches/${encodeURIComponent(me.organization.id)}`)}
              className="focus-ring rounded-sm hover:underline"
            >
              {me.organization.name}
            </Link>
          ) : (
            t("users.noBranch")
          )
        }
      />
    </dl>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-label-12 text-gray-900">{label}</dt>
      <dd className="truncate text-copy-14 text-gray-1000">{value}</dd>
    </div>
  );
}
