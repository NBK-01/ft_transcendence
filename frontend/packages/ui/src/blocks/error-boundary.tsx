import { TriangleAlert } from "lucide-react";
import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { LogoMark } from "@trans/ui/blocks/logo";
import { SiteFooter } from "@trans/ui/blocks/site-footer";
import { Button } from "@trans/ui/components/button";

/**
 * Same page chrome as NotFoundPage, with EmptyState's icon badge for the crash
 * itself. Exported on its own too: react-router's data routers catch render
 * errors inside their own route-level boundary before they ever reach ours,
 * so routers use this directly as `errorElement`/`ErrorBoundary`.
 *
 * `withFooter` defaults on for that router usage (SiteFooter's legal links
 * need router context, which a route always has). `ErrorBoundary` below can
 * fire above the router too, so it renders this with the footer left out.
 */
export function ErrorFallback({ withFooter = true }: { withFooter?: boolean } = {}) {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-dvh flex-col bg-background-100">
      <title>{`${t("crash.title")} · ${t("brand.name")}`}</title>
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <LogoMark className="size-10" />
        <span className="grid size-12 place-items-center rounded-xl border border-gray-alpha-400 bg-background-200 shadow-xs">
          <TriangleAlert className="size-5 text-gray-900" aria-hidden="true" />
        </span>
        <div className="flex max-w-sm flex-col gap-2">
          <h1 className="text-heading-32 text-balance">{t("crash.title")}</h1>
          <p className="text-copy-16 text-pretty text-gray-900">{t("crash.body")}</p>
        </div>
        {/* A render crash can leave the app in a broken state a reset can't fix; reload is the reliable escape hatch. */}
        <Button onClick={() => window.location.reload()}>{t("crash.action")}</Button>
      </main>
      {withFooter && <SiteFooter />}
    </div>
  );
}

/**
 * Catches render errors anywhere below it so one broken subtree blanks a
 * fallback page instead of the whole app. Must be a class component: React
 * only calls getDerivedStateFromError/componentDidCatch on class instances.
 * Covers crashes outside the router tree (e.g. in a provider); route content
 * itself is guarded by `ErrorFallback` as each router's `errorElement`.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    // No guarantee a router is mounted above this boundary, so skip the footer: it needs router context.
    return this.state.hasError ? <ErrorFallback withFooter={false} /> : this.props.children;
  }
}
