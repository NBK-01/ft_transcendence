import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, Building2, KeyRound, LayoutGrid, MessageSquare, Package, Plus, Users } from "lucide-react";

import { AppShell, type NavGroup } from "@trans/ui/blocks/app-shell";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Logo } from "@trans/ui/blocks/logo";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";

const NAV: NavGroup[] = [
  {
    items: [
      { to: "/", label: "Overview", icon: LayoutGrid, end: true },
      { to: "/shipments", label: "Shipments", icon: Package },
      { to: "/messages", label: "Messages", icon: MessageSquare, badge: <Badge size="sm">3</Badge> },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/users", label: "Users", icon: Users },
      { to: "/branches", label: "Branches", icon: Building2 },
      { to: "/api-keys", label: "API keys", icon: KeyRound },
    ],
  },
];

const meta = {
  title: "Blocks/App Shell",
  component: AppShell,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    brand: <Logo label="Admin" />,
    nav: NAV,
    user: { name: "Amina El Idrissi", email: "amina@shiptrack.example", role: "Administrator" },
    onSignOut: () => {},
    profileHref: "/profile",
    topbarStart: <span className="text-label-14 text-gray-900">All branches</span>,
    topbarEnd: (
      <Button variant="tertiary" shape="square" size="sm" aria-label="Notifications">
        <Bell />
      </Button>
    ),
    children: (
      <div className="flex flex-col gap-8">
        <PageHeader title="Overview" description="Live view of every branch." />
        <EmptyState
          icon={Package}
          title="Nothing here yet"
          description="Data arrives once the API is wired."
          action={<Button prefix={<Plus />}>New shipment</Button>}
        />
      </div>
    ),
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: {
    docs: { description: { story: "Below 768px the sidebar becomes a floating bottom bar; extra items go in “More”." } },
  },
};
