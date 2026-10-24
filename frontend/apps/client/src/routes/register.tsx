import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { EMAIL_ALREADY_REGISTERED, isApiError, useRegister } from "@trans/api";
import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Checkbox } from "@trans/ui/components/checkbox";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { PasswordInput } from "@trans/ui/components/password-input";
import { signUpSchema, type SignUpValues } from "@trans/ui/schemas/auth";

/** /register: new customer account. Verification (POST /auth/verify-otp) finishes the job — no session starts here. */
export function RegisterPage() {
  const { t } = useTranslation(["common", "app"]);

  return (
    <AuthLayout
      title={t("auth.signUpTitle")}
      subtitle={t("auth.signUpSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-medium text-gray-1000 underline-offset-4 hover:underline">
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <title>{`${t("auth.signUp")} · ${t("brand.name")}`}</title>
      <RegisterForm />
    </AuthLayout>
  );
}

function RegisterForm() {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const register = useRegister();
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      // The backend takes one `name` field; the form splits it for a friendlier UI.
      const { email } = await register.mutateAsync({
        email: values.email,
        password: values.password,
        name: `${values.firstName} ${values.lastName}`.trim(),
      });
      void navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
      if (isApiError(error) && error.errorCode === EMAIL_ALREADY_REGISTERED) {
        form.setError("email", { message: "app:register.emailTaken" });
      } else {
        form.setError("root", { message: "app:register.error" });
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("auth.firstName")} error={errors.firstName?.message}>
          <Input autoComplete="given-name" autoFocus {...form.register("firstName")} />
        </Field>
        <Field label={t("auth.lastName")} error={errors.lastName?.message}>
          <Input autoComplete="family-name" {...form.register("lastName")} />
        </Field>
      </div>
      <Field label={t("auth.email")} error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="username"
          placeholder={t("auth.emailPlaceholder")}
          dir="ltr"
          {...form.register("email")}
        />
      </Field>
      <Field label={t("auth.password")} hint={errors.password ? undefined : t("auth.passwordHint")} error={errors.password?.message}>
        <PasswordInput autoComplete="new-password" placeholder={t("auth.passwordPlaceholder")} dir="ltr" {...form.register("password")} />
      </Field>
      <Field label={t("auth.confirmPassword")} error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" dir="ltr" {...form.register("confirmPassword")} />
      </Field>
      <Controller
        control={form.control}
        name="acceptTerms"
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-2.5 text-copy-14 text-gray-900">
              <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
              <Trans
                t={t}
                i18nKey="auth.acceptTerms"
                components={{
                  terms: <Link to="/terms" className="font-medium text-gray-1000 underline-offset-4 hover:underline" />,
                  privacy: <Link to="/privacy" className="font-medium text-gray-1000 underline-offset-4 hover:underline" />,
                }}
              />
            </label>
            {errors.acceptTerms?.message && <FieldError message={errors.acceptTerms.message} />}
          </div>
        )}
      />
      {errors.root?.message && <FieldError message={errors.root.message} />}
      <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
        {t("auth.signUp")}
      </Button>
    </form>
  );
}
