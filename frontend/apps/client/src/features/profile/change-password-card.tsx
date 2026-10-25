import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { INVALID_CREDENTIALS, isApiError, useChangePassword } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@trans/ui/components/card";
import { Field, FieldError } from "@trans/ui/components/field";
import { PasswordInput } from "@trans/ui/components/password-input";
import { toast } from "@trans/ui/components/toaster";
import { changePasswordSchema, type ChangePasswordValues } from "@trans/ui/schemas/auth";

const EMPTY: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

/** POST /auth/change-password. `email` is for password managers, so they update the right entry. */
export function ChangePasswordCard({ email }: { email: string }) {
  const { t } = useTranslation(["common", "app"]);
  const change = useChangePassword();
  const form = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      toast.success(t("app:profile.changed"));
      form.reset(EMPTY);
    } catch (error) {
      if (isApiError(error) && error.errorCode === INVALID_CREDENTIALS) {
        form.setError("currentPassword", { message: "app:profile.wrongPassword" }, { shouldFocus: true });
      } else {
        form.setError("root", { message: "app:profile.changeError" });
      }
    }
  });

  return (
    <Card>
      <form onSubmit={submit} noValidate aria-labelledby="password-title">
        <CardHeader>
          <CardTitle id="password-title">{t("app:profile.passwordTitle")}</CardTitle>
          <CardDescription>{t("app:profile.passwordDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex max-w-sm flex-col gap-5">
          {/* Not shown: tells password managers which account this is. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <Field label={t("app:profile.currentPassword")} error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" dir="ltr" {...form.register("currentPassword")} />
          </Field>
          <Field label={t("app:profile.newPassword")} hint={t("auth.passwordHint")} error={errors.newPassword?.message}>
            <PasswordInput autoComplete="new-password" dir="ltr" {...form.register("newPassword")} />
          </Field>
          <Field label={t("auth.confirmPassword")} error={errors.confirmPassword?.message}>
            <PasswordInput autoComplete="new-password" dir="ltr" {...form.register("confirmPassword")} />
          </Field>
          {errors.root?.message && <FieldError message={errors.root.message} />}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" size="sm" loading={change.isPending}>
            {t("app:profile.changePassword")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
