import type { Meta, StoryObj } from "@storybook/react-vite";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDelete } from "@trans/ui/blocks/confirm-delete";
import { createDataTableColumnHelper, DataTable } from "@trans/ui/blocks/data-table";
import { Button } from "@trans/ui/components/button";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const meta = {
  title: "Blocks/Confirm Delete",
  component: ConfirmDelete,
  tags: ["autodocs"],
  args: {
    trigger: (
      <Button variant="error" prefix={<Trash2 />}>
        Delete user
      </Button>
    ),
    title: "Delete this user?",
    description: "Jane loses access to ShipTrack immediately. Their shipment history is kept. This can't be undone.",
    confirmText: "jane@acme.io",
    actionLabel: "Delete user",
    onConfirm: () => {
      toast.success("User deleted");
    },
  },
} satisfies Meta<typeof ConfirmDelete>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The delete button stays disabled until the email is typed exactly. */
export const Default: Story = {};

/** No typing step, e.g. bulk actions from a DataTable selection. */
export const WithoutTyping: Story = {
  args: {
    trigger: <Button variant="error">Cancel 4 shipments</Button>,
    title: "Cancel 4 shipments?",
    description: "Customers are notified and drivers are unassigned.",
    confirmText: undefined,
    actionLabel: "Cancel shipments",
  },
};

/** The button shows a spinner while the request runs; the dialog closes when it succeeds. */
export const AsyncSuccess: Story = {
  args: {
    onConfirm: async () => {
      await wait(1000);
      toast.success("User deleted");
    },
  },
};

/** A failed request keeps the dialog open with an inline error, so the user can retry. */
export const AsyncFailure: Story = {
  args: {
    onConfirm: async () => {
      await wait(1000);
      throw new Error("500");
    },
  },
};

type Branch = { id: string; name: string; members: number };

const branches: Branch[] = [
  { id: "br_1", name: "Amman Central", members: 24 },
  { id: "br_2", name: "Irbid North", members: 11 },
  { id: "br_3", name: "Aqaba Port", members: 7 },
];

const column = createDataTableColumnHelper<Branch>();

/**
 * Controlled with `open`/`onOpenChange`, opened from a row action. `open` is
 * separate from `target` so the text doesn't blank out while the dialog fades.
 */
export const FromTableRow: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [rows, setRows] = useState(branches);
    const [target, setTarget] = useState<Branch | null>(null);
    const [open, setOpen] = useState(false);

    const [columns] = useState(() =>
      column.columns([
        column.accessor("name", { header: "Branch" }),
        column.accessor("members", { header: "Members", meta: { align: "end" } }),
        column.display({
          id: "actions",
          cell: ({ row }) => (
            <Button
              variant="tertiary"
              size="sm"
              shape="square"
              aria-label={`Delete ${row.original.name}`}
              onClick={() => {
                setTarget(row.original);
                setOpen(true);
              }}
            >
              <Trash2 />
            </Button>
          ),
          meta: { align: "end" },
        }),
      ]),
    );

    return (
      <div className="mx-auto w-full max-w-2xl">
        <DataTable columns={columns} data={rows} getRowId={(row) => row.id} />
        <ConfirmDelete
          open={open}
          onOpenChange={setOpen}
          title="Delete this branch?"
          description={`${target?.members ?? 0} members will be moved to "No branch".`}
          confirmText={target?.name}
          actionLabel="Delete branch"
          onConfirm={async () => {
            await wait(600);
            setRows((current) => current.filter((row) => row.id !== target?.id));
            toast.success("Branch deleted");
          }}
        />
      </div>
    );
  },
};
