import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router";

import {
  isApiError,
  STAFF_ACCOUNT_INACTIVE,
  STAFF_INVALID_CREDENTIALS,
  useStaffLogin,
  useStaffSession,
} from "@trans/api";
import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { PasswordInput } from "@trans/ui/components/password-input";
import { signInSchema, type SignInValues } from "@trans/ui/schemas/auth";

/** `next` only when it's a path in this app ("/users"), never another site ("//evil.example"). */
function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** /login: staff sign-in. Once signed in (already, or just now), goes on to `?next=` or the overview. */
export function LoginPage() {
  const { t } = useTranslation(["common", "app"]);
  const session = useStaffSession();
  const [params] = useSearchParams();

  if (session.status === "authenticated") return <Navigate to={safeNext(params.get("next"))} replace />;

  return (
    <AuthLayout
      title={t("auth.adminSignInTitle")}
      subtitle={t("auth.adminSignInSubtitle")}
      logoLabel={t("app:logoLabel")}
      showPanel={false}
    >
      <title>{`${t("auth.signIn")} · ${t("brand.name")}`}</title>
      <LoginForm />
    </AuthLayout>
  );
}

function LoginForm() {
  const { t } = useTranslation(["common", "app"]);
  const login = useStaffLogin();
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
      if (code === STAFF_INVALID_CREDENTIALS) {
        form.setError("root", { message: "app:login.invalidCredentials" });
        // Most often the password is what's wrong: clear it and start there.
        form.resetField("password");
        form.setFocus("password");
      } else {
        form.setError("root", { message: code === STAFF_ACCOUNT_INACTIVE ? "app:login.inactive" : "app:login.error" });
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
      <Field label={t("auth.password")} error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" dir="ltr" {...form.register("password")} />
      </Field>
      {errors.root?.message && <FieldError message={errors.root.message} />}
      <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
        {t("auth.signIn")}
      </Button>
    </form>
  );
}
