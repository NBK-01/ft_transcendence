import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";

import { isApiError, OAUTH_CODE_INVALID, useOAuthExchange } from "@trans/api";
import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Spinner } from "@trans/ui/components/spinner";

/**
 * /auth/oauth-callback: where Google OAuth lands after consent. The backend
 * never returns tokens here — only a one-time `code` (or an `error`) on this
 * redirect. A URL-carried `error` or a missing `code` is known at render time
 * (no effect needed for those); only the actual exchange is an effect.
 */
export function OAuthCallbackPage() {
  const { t } = useTranslation(["common", "app"]);
  const [params] = useSearchParams();
  const code = params.get("code");
  const urlError = params.get("error");

  const failure = urlError ?? (code ? null : t("app:oauthCallback.missingCode"));

  return (
    <AuthLayout title={t("app:oauthCallback.title")} showPanel={false}>
      <title>{`${t("app:oauthCallback.title")} · ${t("brand.name")}`}</title>
      {failure ? <Failure message={failure} /> : <ExchangeCode code={code!} />}
    </AuthLayout>
  );
}

function Failure({ message }: { message: string }) {
  const { t } = useTranslation(["common", "app"]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-copy-14 text-red-900">{message}</p>
      <Button size="lg" className="w-full" asChild>
        <Link to="/login">{t("auth.backToSignIn")}</Link>
      </Button>
    </div>
  );
}

/** The one-time code is single-use: `started` guards against StrictMode's double-invoked effect. */
function ExchangeCode({ code }: { code: string }) {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const exchange = useOAuthExchange();
  const started = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    exchange.mutate(
      { code },
      {
        onSuccess: () => void navigate("/app", { replace: true }),
        onError: (err) => {
          setFailure(
            isApiError(err) && err.errorCode === OAUTH_CODE_INVALID
              ? t("app:oauthCallback.expired")
              : t("app:oauthCallback.error"),
          );
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the code is single-use; this must run exactly once
  }, []);

  if (failure) return <Failure message={failure} />;
  return (
    <div className="flex items-center justify-center gap-2 text-copy-14 text-gray-900">
      <Spinner />
      {t("app:oauthCallback.loading")}
    </div>
  );
}
