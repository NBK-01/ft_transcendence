import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  BadgeCheck,
  Bell,
  BellOff,
  Building2,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  Clock,
  Contact,
  Copy,
  CreditCard,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Headset,
  History,
  Home,
  Hourglass,
  ImagePlus,
  Info,
  KeyRound,
  Languages,
  LayoutGrid,
  ListFilter,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Package,
  PackagePlus,
  PackageX,
  PanelLeft,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SearchX,
  SendHorizontal,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Upload,
  User,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  Weight,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@trans/ui/components/button";

/**
 * Icons come from Lucide (lucide-react), one family everywhere. These are
 * the ones the apps use, by what they mean, so the same idea always gets
 * the same icon.
 */
const meta = {
  title: "Foundations/Icons",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const GROUPS: { title: string; icons: [string, LucideIcon][] }[] = [
  {
    title: "Navigation",
    icons: [
      ["LayoutGrid", LayoutGrid],
      ["Package", Package],
      ["MessageSquare", MessageSquare],
      ["Contact", Contact],
      ["Users", Users],
      ["Building2", Building2],
      ["Home", Home],
      ["KeyRound", KeyRound],
      ["Bell", Bell],
      ["PanelLeft", PanelLeft],
      ["LogOut", LogOut],
    ],
  },
  {
    title: "Actions",
    icons: [
      ["Plus", Plus],
      ["Pencil", Pencil],
      ["Trash2", Trash2],
      ["Copy", Copy],
      ["Download", Download],
      ["Upload", Upload],
      ["Camera", Camera],
      ["ImagePlus", ImagePlus],
      ["Paperclip", Paperclip],
      ["SendHorizontal", SendHorizontal],
      ["Search", Search],
      ["ListFilter", ListFilter],
      ["RotateCcw", RotateCcw],
      ["ExternalLink", ExternalLink],
      ["MoreHorizontal", MoreHorizontal],
      ["Ellipsis", Ellipsis],
    ],
  },
  {
    title: "Status and feedback",
    icons: [
      ["Check", Check],
      ["CheckCheck", CheckCheck],
      ["CircleCheck", CircleCheck],
      ["BadgeCheck", BadgeCheck],
      ["Info", Info],
      ["CircleAlert", CircleAlert],
      ["TriangleAlert", TriangleAlert],
      ["Ban", Ban],
      ["Clock", Clock],
      ["Hourglass", Hourglass],
      ["History", History],
      ["BellOff", BellOff],
      ["SearchX", SearchX],
      ["TrendingUp", TrendingUp],
      ["TrendingDown", TrendingDown],
    ],
  },
  {
    title: "Shipments, files and payments",
    icons: [
      ["Truck", Truck],
      ["PackagePlus", PackagePlus],
      ["PackageX", PackageX],
      ["Weight", Weight],
      ["FileText", FileText],
      ["FileImage", FileImage],
      ["ReceiptText", ReceiptText],
      ["CreditCard", CreditCard],
    ],
  },
  {
    title: "People and accounts",
    icons: [
      ["User", User],
      ["UserRound", UserRound],
      ["UserPlus", UserPlus],
      ["UserMinus", UserMinus],
      ["Headset", Headset],
      ["Mail", Mail],
      ["Lock", Lock],
      ["Eye", Eye],
      ["EyeOff", EyeOff],
    ],
  },
  {
    title: "Settings",
    icons: [
      ["Sun", Sun],
      ["Moon", Moon],
      ["Monitor", Monitor],
      ["Languages", Languages],
      ["ChevronDown", ChevronDown],
      ["ChevronsUpDown", ChevronsUpDown],
      ["ArrowUp", ArrowUp],
      ["ArrowDown", ArrowDown],
    ],
  },
];

/** Every icon the apps use, at the default 16px, with its Lucide name. */
export const Library: Story = {
  render: () => (
    <div className="flex max-w-5xl flex-col gap-10">
      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3" aria-labelledby={`icons-${group.title}`}>
          <h2 id={`icons-${group.title}`} className="text-heading-20">
            {group.title}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {group.icons.map(([name, Icon]) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-lg border border-gray-alpha-400 px-3 py-2.5 text-gray-1000"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <code className="truncate text-label-mono-12 text-gray-900" dir="ltr">
                  {name}
                </code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  ),
};

/** 14px in tiny buttons, 16px beside text, in buttons and the sidebar, 20px in the phone nav and empty states. Button sizes its own. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6 text-gray-1000">
      {(
        [
          ["size-3.5", "14px · tiny buttons"],
          ["size-4", "16px · text, buttons, sidebar"],
          ["size-5", "20px · phone nav, empty states"],
        ] as const
      ).map(([size, label]) => (
        <figure key={size} className="flex flex-col items-center gap-2">
          <Package className={size} aria-hidden="true" />
          <figcaption className="text-label-12 text-gray-900">{label}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

/**
 * Rules: an icon beside text is decorative (aria-hidden); an icon-only
 * button needs an aria-label. Arrows and chevrons that point "back" or
 * "forward" flip in Arabic (`rtl:-scale-x-100`); switch the Language
 * toolbar to see it.
 */
export const Usage: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button prefix={<Plus />}>New shipment</Button>
        <Button variant="secondary" shape="square" aria-label="More actions">
          <MoreHorizontal />
        </Button>
        <Button variant="secondary" prefix={<SendHorizontal className="rtl:-scale-x-100" />}>
          Send
        </Button>
      </div>
      <div className="flex items-center gap-4 text-gray-1000">
        {[ArrowLeft, ArrowRight, ChevronLeft, ChevronRight].map((Icon, index) => (
          <Icon key={index} className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        ))}
        <span className="text-label-13 text-gray-900">Back and forward: flipped in RTL</span>
      </div>
    </div>
  ),
};
