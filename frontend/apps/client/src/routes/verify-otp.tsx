import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { isApiError, useResendOtp, useVerifyOtp } from "@trans/api";
import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { otpSchema, type OtpValues } from "@trans/ui/schemas/auth";

/** No need to match the backend's full progressive-block tiers — a flat cooldown is enough UI. */
const RESEND_COOLDOWN_SECONDS = 30;

/** /verify-otp?email=...: the second half of registration, and where an unverified login lands too. */
export function VerifyOtpPage() {
  const { t } = useTranslation(["common", "app"]);
  const [params] = useSearchParams();
  const email = params.get("email");

  // No email to verify: nothing useful to do here.
  if (!email) return <Navigate to="/register" replace />;

  return (
    <AuthLayout title={t("auth.twoFactorTitle")} subtitle={t("app:otp.subtitle", { email })} showPanel={false}>
      <title>{`${t("auth.twoFactorTitle")} · ${t("brand.name")}`}</title>
      <VerifyOtpForm email={email} />
    </AuthLayout>
  );
}

function VerifyOtpForm({ email }: { email: string }) {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const verify = useVerifyOtp();
  const resend = useResendOtp();
  const [cooldown, setCooldown] = useState(0);
  const form = useForm<OtpValues>({ resolver: zodResolver(otpSchema), defaultValues: { code: "" } });
  const { errors } = form.formState;

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await verify.mutateAsync({ email, otp: values.code });
      void navigate("/app");
    } catch (error) {
      form.setError("root", { message: isApiError(error) && error.messages[0] ? error.messages[0] : "app:otp.error" });
      form.resetField("code");
    }
  });

  const handleResend = async () => {
    try {
      await resend.mutateAsync({ email });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      form.setError("root", {
        message: isApiError(error) && error.messages[0] ? error.messages[0] : "app:otp.resendError",
      });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label={t("auth.code")} error={errors.code?.message}>
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" autoFocus {...form.register("code")} />
      </Field>
      {errors.root?.message && <FieldError message={errors.root.message} />}
      <Button type="submit" size="lg" className="w-full" loading={verify.isPending}>
        {t("auth.verify")}
      </Button>
      <Button
        type="button"
        variant="tertiary"
        size="sm"
        className="w-full"
        disabled={cooldown > 0}
        loading={resend.isPending}
        onClick={() => void handleResend()}
      >
        {cooldown > 0 ? t("auth.resendIn", { seconds: cooldown }) : t("auth.resend")}
      </Button>
    </form>
  );
}
