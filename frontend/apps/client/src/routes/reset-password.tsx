import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { INVALID_RESET_TOKEN, isApiError, useResetPassword } from "@trans/api";
import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { PasswordInput } from "@trans/ui/components/password-input";
import { resetPasswordSchema, type ResetPasswordValues } from "@trans/ui/schemas/auth";

/**
 * /reset-password?token=...: success here force-ends every session on the
 * account server-side, this device included — land on /login, not /app.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation(["common", "app"]);
  const [params] = useSearchParams();
  const token = params.get("token");

  if (!token) return <Navigate to="/forgot-password" replace />;

  return (
    <AuthLayout title={t("app:resetPassword.title")} subtitle={t("app:resetPassword.subtitle")} showPanel={false}>
      <title>{`${t("app:resetPassword.title")} · ${t("brand.name")}`}</title>
      <ResetPasswordForm token={token} />
    </AuthLayout>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const resetPassword = useResetPassword();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync({ token, newPassword: values.newPassword });
      void navigate("/login", { state: { resetPassword: true } });
    } catch (error) {
      if (isApiError(error) && error.errorCode === INVALID_RESET_TOKEN) {
        form.setError("root", { message: "app:resetPassword.invalidToken" });
      } else {
        form.setError("root", { message: "app:resetPassword.error" });
      }
    }
  });

  // A retry on the same form can't help an expired/used link — point at a fresh request instead.
  if (errors.root?.message === "app:resetPassword.invalidToken") {
    return (
      <div className="flex flex-col gap-4">
        <FieldError message={errors.root.message} />
        <Button size="lg" className="w-full" asChild>
          <Link to="/forgot-password">{t("app:resetPassword.requestNewLink")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label={t("app:resetPassword.newPassword")} hint={errors.newPassword ? undefined : t("auth.passwordHint")} error={errors.newPassword?.message}>
        <PasswordInput autoComplete="new-password" placeholder={t("auth.passwordPlaceholder")} dir="ltr" autoFocus {...form.register("newPassword")} />
      </Field>
      <Field label={t("auth.confirmPassword")} error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" dir="ltr" {...form.register("confirmPassword")} />
      </Field>
      {errors.root?.message && <FieldError message={errors.root.message} />}
      <Button type="submit" size="lg" className="w-full" loading={resetPassword.isPending}>
        {t("app:resetPassword.submit")}
      </Button>
    </form>
  );
}
