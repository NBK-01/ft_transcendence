import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { LanguageSwitcher } from "@trans/ui/blocks/language-switcher";
import { Logo } from "@trans/ui/blocks/logo";
import { SiteFooter } from "@trans/ui/blocks/site-footer";
import { ThemeSwitcher } from "@trans/ui/blocks/theme-switcher";
import { cn } from "@trans/ui/lib/utils";

export type LegalSection = { id: string; title: string; body: string[] };
export type LegalDocument = { title: string; intro: string; sections: LegalSection[] };

/** Highlights the section currently in view in the table of contents. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  // Stable dependency: the ids array is rebuilt on every render.
  const idsKey = ids.join("|");

  useEffect(() => {
    const ids = idsKey.split("|");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -66% 0px" },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [idsKey]);

  return active;
}

/**
 * Privacy Policy / Terms of Service page: a ~680px reading column with a
 * sticky "On this page" list on the end side (it flips in RTL).
 */
export function LegalLayout({
  document: doc,
  updatedAt,
  logoLabel,
  backHref = "/",
}: {
  document: LegalDocument;
  /** ISO date, e.g. "2026-10-07". */
  updatedAt: string;
  logoLabel?: string;
  backHref?: string;
}) {
  const { t, i18n } = useTranslation("common");
  const active = useActiveSection(doc.sections.map((section) => section.id));
  const formattedDate = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "long" }).format(
    new Date(`${updatedAt}T00:00:00`),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background-100">
      <header className="sticky top-0 z-20 border-b border-gray-alpha-400 bg-background-100">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
          <Link to={backHref} className="focus-ring rounded-md" aria-label={t("brand.name")}>
            <Logo label={logoLabel} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-16 px-4 py-12 md:px-8 md:py-16 lg:grid-cols-[minmax(0,680px)_200px] lg:justify-between">
        <main id="main" className="min-w-0">
          <Link
            to={backHref}
            className="focus-ring mb-8 inline-flex items-center gap-1.5 rounded-sm text-label-13 text-gray-900 transition-colors duration-150 hover:text-gray-1000"
          >
            <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
            {t("brand.name")}
          </Link>

          <p className="text-label-mono-12 text-gray-900 uppercase">{t("footer.legal")}</p>
          <h1 className="mt-3 text-heading-48 text-balance">{doc.title}</h1>
          <p className="mt-4 text-label-mono-13 text-gray-900">
            {t("legal.lastUpdated")} · <time dateTime={updatedAt}>{formattedDate}</time>
          </p>
          <p className="mt-8 text-copy-18 text-pretty text-gray-1000">{doc.intro}</p>

          <div className="mt-12 flex flex-col gap-12">
            {doc.sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
                <h2 id={`${section.id}-title`} className="flex items-baseline gap-3 text-heading-24 text-balance">
                  <span className="text-label-mono-13 text-gray-700 tabular-nums" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4 flex flex-col gap-4">
                  {section.body.map((paragraph, i) => (
                    <p key={i} className="text-copy-16 text-pretty text-gray-900">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-16 border-t border-gray-alpha-400 pt-6 text-copy-14 text-gray-900">{t("legal.contact")}</p>
        </main>

        <nav aria-label={t("legal.onThisPage")} className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-3">
            <p className="text-label-13 font-medium text-gray-1000">{t("legal.onThisPage")}</p>
            <ul className="flex flex-col gap-0.5 border-s border-gray-alpha-400">
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={active === section.id ? "location" : undefined}
                    className={cn(
                      "focus-ring -ms-px block border-s py-1 ps-3 text-label-13 text-pretty transition-colors duration-150",
                      active === section.id
                        ? "border-orange-700 text-gray-1000"
                        : "border-transparent text-gray-900 hover:text-gray-1000",
                    )}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      <SiteFooter />
    </div>
  );
}
