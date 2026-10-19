import { ChevronRight } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@trans/ui/lib/utils";

/**
 * Where the page sits, e.g. Branches › Paris Oberkampf. Goes at the top of a
 * detail page, above its PageHeader.
 *
 *   <Breadcrumb>
 *     <BreadcrumbList>
 *       <BreadcrumbItem>
 *         <BreadcrumbLink asChild><Link to="/branches">Branches</Link></BreadcrumbLink>
 *       </BreadcrumbItem>
 *       <BreadcrumbSeparator />
 *       <BreadcrumbItem><BreadcrumbPage>Paris Oberkampf</BreadcrumbPage></BreadcrumbItem>
 *     </BreadcrumbList>
 *   </Breadcrumb>
 */
export function Breadcrumb({ "aria-label": label, ...props }: ComponentProps<"nav">) {
  const { t } = useTranslation("common");
  return <nav data-slot="breadcrumb" aria-label={label ?? t("nav.breadcrumb")} {...props} />;
}

export function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5 text-label-14 text-gray-900", className)}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return <li data-slot="breadcrumb-item" className={cn("inline-flex min-w-0 items-center", className)} {...props} />;
}

/** Long names are cut off with "…"; a string child also becomes the hover title, so the full name stays reachable. */
const truncate = "block max-w-[16rem] truncate sm:max-w-[24rem]";

export function BreadcrumbLink({
  asChild = false,
  className,
  title,
  children,
  ...props
}: ComponentProps<"a"> & {
  /** Render the child (e.g. a router <Link>) with the link styles. */
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="breadcrumb-link"
      title={title ?? (typeof children === "string" ? children : undefined)}
      className={cn(
        // With asChild, Slot merges these onto the child link.
        truncate,
        "focus-ring rounded-sm underline-offset-4 transition-colors duration-150 hover:text-gray-1000 hover:underline",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function BreadcrumbPage({ className, title, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      // Usually a name (user data, any script): its own direction keeps the "…" at its end.
      dir="auto"
      title={title ?? (typeof children === "string" ? children : undefined)}
      className={cn(truncate, "text-gray-1000", className)}
      {...props}
    >
      {children}
    </span>
  );
}

/** A chevron that points the reading direction, so it flips in Arabic. */
export function BreadcrumbSeparator({ className, children, ...props }: ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("text-gray-700 [&_svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight className="rtl:-scale-x-100" />}
    </li>
  );
}
