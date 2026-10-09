import type { Meta, StoryObj } from "@storybook/react-vite";

import { AuthLayout } from "@trans/ui/blocks/auth-layout";
import { Button } from "@trans/ui/components/button";
import { Field } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { PasswordInput } from "@trans/ui/components/password-input";

const meta = {
  title: "Blocks/Auth Layout",
  component: AuthLayout,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    title: "Sign in to ShipTrack",
    subtitle: "Track shipments and talk to your branch in real time.",
    children: (
      <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()}>
        <Field label="Email">
          <Input type="email" autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <PasswordInput autoComplete="current-password" />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          Sign in
        </Button>
      </form>
    ),
    footer: (
      <span>
        Don't have an account?{" "}
        <a href="#signup" className="font-medium text-gray-1000 underline underline-offset-4">
          Sign up
        </a>
      </span>
    ),
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPanel: Story = {};
export const Admin: Story = { args: { logoLabel: "Admin", showPanel: false, title: "Sign in to ShipTrack Admin" } };
