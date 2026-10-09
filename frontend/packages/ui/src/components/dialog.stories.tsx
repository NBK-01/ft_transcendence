import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@trans/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@trans/ui/components/dialog";
import { Field } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";

const meta = {
  title: "Components/Overlays/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="secondary">Invite member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member to Casablanca — Maârif</DialogTitle>
          <DialogDescription>They'll get an email with a link to join this branch.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Email">
            <Input type="email" placeholder="driver@example.com" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button>Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Open: Story = { args: { defaultOpen: true }, parameters: { layout: "fullscreen" } };
