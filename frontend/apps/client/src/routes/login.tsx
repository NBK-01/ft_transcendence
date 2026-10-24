import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { ACCOUNT_NOT_VERIFIED, INVALID_CREDENTIALS, isApiError, useLogin, useSession, WRONG_AUTH_PROVIDER } from "@trans/api";
import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { PasswordInput } from "@trans/ui/components/password-input";
import { signInSchema, type SignInValues } from "@trans/ui/schemas/auth";

/** `next` only when it's a path in this app ("/app/profile"), never another site ("//evil.example"). */
function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

/** /login: customer sign-in. Once signed in (already, or just now), goes on to `?next=` or the shipments list. */
export function LoginPage() {
  const { t } = useTranslation(["common", "app"]);
  const session = useSession();
  const [params] = useSearchParams();

  if (session.status === "authenticated") return <Navigate to={safeNext(params.get("next"))} replace />;

  return (
    <AuthLayout
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="font-medium text-gray-1000 underline-offset-4 hover:underline">
            {t("auth.signUp")}
          </Link>
        </>
      }
    >
      <title>{`${t("auth.signIn")} · ${t("brand.name")}`}</title>
      <LoginForm />
    </AuthLayout>
  );
}

function LoginForm() {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const login = useLogin();
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
    } catch (error) {
      const code = isApiError(error) ? error.errorCode : undefined;
      if (code === INVALID_CREDENTIALS) {
        form.setError("root", { message: "app:login.invalidCredentials" });
        // Most often the password is what's wrong: clear it and start there.
        form.resetField("password");
        form.setFocus("password");
      } else if (code === ACCOUNT_NOT_VERIFIED) {
        // Not an error from the user's point of view: finish what registration started.
        void navigate(`/verify-otp?email=${encodeURIComponent(values.email)}`);
      } else if (code === WRONG_AUTH_PROVIDER) {
        form.setError("root", { message: "app:login.wrongProvider" });
      } else {
        form.setError("root", { message: "app:login.error" });
      }
    }
  });

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
      <Field
        label={t("auth.password")}
        labelAction={
          <Link to="/forgot-password" className="text-label-13 text-gray-900 underline-offset-4 hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        }
        error={errors.password?.message}
      >
        <PasswordInput autoComplete="current-password" dir="ltr" {...form.register("password")} />
      </Field>
      {errors.root?.message && <FieldError message={errors.root.message} />}
      <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
        {t("auth.signIn")}
      </Button>

      <div className="flex items-center gap-3 text-label-12 text-gray-900" aria-hidden="true">
        <span className="h-px flex-1 bg-gray-alpha-400" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-gray-alpha-400" />
      </div>
      {/* Not a fetch call: a real navigation. The backend redirects to Google, then back to /auth/oauth-callback. */}
      <Button asChild variant="secondary" size="lg" className="w-full">
        <a href="/api/auth/google">{t("app:login.continueWithGoogle")}</a>
      </Button>
    </form>
  );
}
