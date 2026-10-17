import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusBadge, type ShipmentStatus } from "@trans/ui/blocks/status";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@trans/ui/components/table";

const shipments: { id: string; route: string; status: ShipmentStatus; weight: number }[] = [
  { id: "TRK-48213", route: "Amman → Irbid", status: "in_transit", weight: 12.5 },
  { id: "TRK-48207", route: "Aqaba → Amman", status: "delivered", weight: 3.2 },
  { id: "TRK-48199", route: "Zarqa → Madaba", status: "requested", weight: 48 },
  { id: "TRK-48190", route: "Irbid → Aqaba", status: "cancelled", weight: 7.75 },
];

const meta = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-[40rem] max-w-[calc(100vw-2rem)]">{Story()}</div>],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Markup only. For sorting, filters and pagination, use DataTable. */
export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Shipments created today.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking ID</TableHead>
          <TableHead>Route</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-end">Weight (kg)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((shipment) => (
          <TableRow key={shipment.id}>
            <TableCell className="text-label-mono-13">{shipment.id}</TableCell>
            <TableCell>{shipment.route}</TableCell>
            <TableCell>
              <StatusBadge status={shipment.status} size="sm" />
            </TableCell>
            <TableCell className="text-end tabular-nums">{shipment.weight}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-end tabular-nums">
            {shipments.reduce((sum, shipment) => sum + shipment.weight, 0)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
