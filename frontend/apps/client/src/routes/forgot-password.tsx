import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useForgotPassword } from "@trans/api";
import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Field } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@trans/ui/schemas/auth";

/**
 * /forgot-password: the backend answers the same way whether or not the email
 * exists (anti-enumeration) — this page must never imply otherwise, so success
 * is a fixed confirmation panel, not an echo of what was submitted.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation(["common", "app"]);
  const forgotPassword = useForgotPassword();

  return (
    <AuthLayout title={t("app:forgotPassword.title")} subtitle={t("app:forgotPassword.subtitle")} showPanel={false}>
      <title>{`${t("app:forgotPassword.title")} · ${t("brand.name")}`}</title>
      {forgotPassword.isSuccess ? <CheckEmail /> : <ForgotPasswordForm forgotPassword={forgotPassword} />}
    </AuthLayout>
  );
}

function CheckEmail() {
  const { t } = useTranslation(["common", "app"]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-copy-14 text-gray-900">{t("app:forgotPassword.checkEmail")}</p>
      <Button variant="secondary" size="lg" className="w-full" asChild>
        <Link to="/login">{t("auth.backToSignIn")}</Link>
      </Button>
    </div>
  );
}

function ForgotPasswordForm({ forgotPassword }: { forgotPassword: ReturnType<typeof useForgotPassword> }) {
  const { t } = useTranslation(["common", "app"]);
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) => forgotPassword.mutate(values));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label={t("auth.email")} error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="username"
          placeholder={t("auth.emailPlaceholder")}
          dir="ltr"
          autoFocus
          {...form.register("email")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={forgotPassword.isPending}>
        {t("app:forgotPassword.submit")}
      </Button>
    </form>
  );
}
