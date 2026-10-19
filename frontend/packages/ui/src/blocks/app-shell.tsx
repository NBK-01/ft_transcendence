import type { LucideIcon } from "lucide-react";
import { Ellipsis, LogOut, PanelLeft, User } from "lucide-react";
import { Direction } from "radix-ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router";

import { SiteFooter } from "@trans/ui/blocks/site-footer";
import { Avatar } from "@trans/ui/components/avatar";
import { Button } from "@trans/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@trans/ui/components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trans/ui/components/tooltip";
import { cn } from "@trans/ui/lib/utils";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly (use for index routes). */
  end?: boolean;
  /** Small count or badge shown on the end edge (e.g. unread notifications). */
  badge?: ReactNode;
};

export type NavGroup = { label?: string; items: NavItem[] };

export type ShellUser = { name: string; email: string; avatarUrl?: string | null; role?: string };

const SIDEBAR_STORAGE_KEY = "trans-sidebar-collapsed";
const MOBILE_BAR_SLOTS = 4;

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Authenticated layout, modelled on Vercel's 2026 dashboard:
 *  - md+: hideable sidebar (icons-only when collapsed) + slim topbar
 *  - < md: topbar + floating bottom bar; overflow items live in a "More" sheet
 */
export function AppShell({
  brand,
  nav,
  user,
  onSignOut,
  profileHref,
  topbarStart,
  topbarEnd,
  children,
}: {
  brand: ReactNode;
  nav: NavGroup[];
  user: ShellUser;
  onSignOut: () => void;
  /** Adds a "Profile" item to the account menu. */
  profileHref?: string;
  /** e.g. breadcrumb or branch switcher. */
  topbarStart?: ReactNode;
  /** e.g. notifications button. */
  topbarEnd?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation("common");
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? "0" : "1");
      } catch {
        // Non-critical preference.
      }
      return !value;
    });
  };

  const allItems = nav.flatMap((group) => group.items);

  return (
    <div className="flex min-h-dvh bg-background-200">
      <a
        href="#main"
        className="focus-ring sr-only z-50 rounded-md bg-gray-1000 px-3 py-2 text-button-14 text-background-100 focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t("nav.skipToContent")}
      </a>

      {/* Sidebar (md+) */}
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-gray-alpha-400 bg-background-100 md:flex",
          collapsed ? "w-15" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "px-4")}>
          {collapsed ? <span className="[&_[data-wordmark]]:hidden">{brand}</span> : brand}
        </div>

        <nav aria-label={t("nav.main")} className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-3">
          {nav.map((group, index) => (
            <div key={group.label ?? index} className="flex flex-col gap-0.5">
              {group.label && !collapsed && (
                <p className="px-2.5 pb-1.5 text-label-12 text-gray-900">{group.label}</p>
              )}
              {group.items.map((item) => (
                <SidebarLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-alpha-400 p-2.5">
          <AccountMenu user={user} onSignOut={onSignOut} profileHref={profileHref} collapsed={collapsed} />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-gray-alpha-400 bg-background-100 px-3 md:px-4">
          <div className="md:hidden">{brand}</div>
          <Button
            variant="tertiary"
            size="sm"
            shape="square"
            className="hidden md:inline-flex"
            onClick={toggleCollapsed}
            aria-label={t("nav.toggleSidebar")}
            aria-expanded={!collapsed}
          >
            <PanelLeft className="rtl:-scale-x-100" aria-hidden="true" />
          </Button>
          {topbarStart && <div className="hidden min-w-0 items-center gap-2 md:flex">{topbarStart}</div>}
          <div className="ms-auto flex items-center gap-1.5">
            {topbarEnd}
            <div className="md:hidden">
              <AccountMenu user={user} onSignOut={onSignOut} profileHref={profileHref} compact />
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none md:px-8 md:py-10">
          {children}
        </main>

        <SiteFooter className="mb-24 bg-background-100 md:mb-0" />
      </div>

      <MobileNavBar items={allItems} />
    </div>
  );
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { icon: Icon } = item;
  const dir = Direction.useDirection();
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "focus-ring group relative flex h-9 items-center gap-2.5 rounded-md text-label-14 text-gray-900",
          "transition-colors duration-150 hover:bg-gray-alpha-100 hover:text-gray-1000",
          collapsed ? "justify-center" : "px-2.5",
          isActive && "bg-gray-alpha-100 font-medium text-gray-1000",
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator: the one orange accent in the navigation. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-2 -start-2.5 w-0.5 rounded-e-full bg-orange-700 transition-opacity duration-150",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && item.badge != null && <span className="ms-auto">{item.badge}</span>}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side={dir === "rtl" ? "left" : "right"}>{item.label}</TooltipContent>
    </Tooltip>
  );
}

function AccountMenu({
  user,
  onSignOut,
  profileHref,
  collapsed = false,
  compact = false,
}: {
  user: ShellUser;
  onSignOut: () => void;
  profileHref?: string;
  collapsed?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation("common");
  const iconOnly = collapsed || compact;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("nav.account")}
        className={cn(
          "focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-md text-start transition-colors duration-150 hover:bg-gray-alpha-100",
          iconOnly ? "size-9 justify-center" : "h-11 px-2",
          compact && "rounded-full",
        )}
      >
        <Avatar name={user.name} src={user.avatarUrl} size={compact ? "sm" : "md"} />
        {!iconOnly && (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-label-13 font-medium text-gray-1000">{user.name}</span>
            <span className="truncate text-label-12 text-gray-900">{user.role ?? user.email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2">
          <span className="truncate text-label-14 font-medium text-gray-1000">{user.name}</span>
          <span className="truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref && (
          <>
            <DropdownMenuItem asChild>
              <Link to={profileHref}>
                <User aria-hidden="true" />
                {t("nav.profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut className="rtl:-scale-x-100" aria-hidden="true" />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const mobileItemClasses = (isActive: boolean) =>
  cn(
    "focus-ring relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-label-12 text-gray-900",
    "transition-colors duration-150",
    isActive && "text-gray-1000",
  );

/** Floating bottom bar for phones. Respects the iOS home-indicator safe area. */
function MobileNavBar({ items }: { items: NavItem[] }) {
  const { t } = useTranslation("common");
  const [moreOpen, setMoreOpen] = useState(false);
  const overflow = items.length > MOBILE_BAR_SLOTS + 1;
  const primary = overflow ? items.slice(0, MOBILE_BAR_SLOTS) : items;
  const rest = overflow ? items.slice(MOBILE_BAR_SLOTS) : [];

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 md:hidden"
    >
      <div
        className="grid rounded-2xl border border-gray-alpha-400 bg-background-100 p-1 shadow-lg"
        style={{ gridTemplateColumns: `repeat(${primary.length + (overflow ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {primary.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => mobileItemClasses(isActive)}>
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className="size-5" aria-hidden="true" />
                  {/* Opaque backing, so a translucent badge doesn't let the icon show through. */}
                  {badge != null && (
                    <span className="absolute -top-2 start-3 rounded-full bg-background-100">{badge}</span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
                {isActive && (
                  <span aria-hidden="true" className="absolute top-1 size-1 rounded-full bg-orange-700" />
                )}
              </>
            )}
          </NavLink>
        ))}
        {overflow && (
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger className={mobileItemClasses(false)}>
              <span className="relative">
                <Ellipsis className="size-5" aria-hidden="true" />
                {/* A badge hidden in the sheet still shows that something's waiting. */}
                {rest.some((item) => item.badge != null) && (
                  <span aria-hidden="true" className="absolute -top-0.5 -end-1 size-2 rounded-full bg-orange-700" />
                )}
              </span>
              <span>{t("nav.more")}</span>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>{t("nav.more")}</SheetTitle>
                <SheetDescription className="sr-only">{t("nav.main")}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-0.5 px-2 pb-4">
                {rest.map(({ to, label, icon: Icon, end, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "focus-ring flex h-12 items-center gap-3 rounded-lg px-3 text-label-16 text-gray-900",
                        isActive && "bg-gray-alpha-100 text-gray-1000",
                      )
                    }
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                    {badge != null && <span className="ms-auto">{badge}</span>}
                  </NavLink>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
}
