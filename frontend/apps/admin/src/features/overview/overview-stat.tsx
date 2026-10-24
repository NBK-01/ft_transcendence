import { Link } from "react-router";

import { isForbidden } from "@trans/api";
import { StatCard, type StatCardProps } from "@trans/ui/blocks/stat-card";
import { cn } from "@trans/ui/lib/utils";

/**
 * A StatCard that opens its page (`to`). A card that failed is a plain card,
 * since its retry button can't sit inside a link. A 403 (the role changed
 * since signing in) drops the card instead of showing an error.
 */
export function OverviewStat({ to, className, ...props }: StatCardProps & { to?: string }) {
  if (isForbidden(props.error)) return null;
  if (!to || (props.error && !props.isLoading)) return <StatCard className={className} {...props} />;
  return (
    <Link to={to} className={cn("group focus-ring rounded-xl", className)}>
      <StatCard
        {...props}
        className="h-full transition-colors duration-150 group-hover:border-gray-alpha-500 group-hover:bg-background-200"
      />
    </Link>
  );
}
