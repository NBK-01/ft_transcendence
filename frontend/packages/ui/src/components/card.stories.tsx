import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@trans/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@trans/ui/components/card";
import { Input } from "@trans/ui/components/input";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-[28rem] max-w-[calc(100vw-2rem)]">{Story()}</div>],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Vercel settings-card pattern: content on top, a tinted footer strip with the action. */
export const SettingsCard: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Branch name</CardTitle>
        <CardDescription>Shown to customers on tracking pages and notifications.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input defaultValue="Casablanca — Maârif" aria-label="Branch name" />
      </CardContent>
      <CardFooter className="justify-between">
        <span>Use 32 characters at most.</span>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Shipments today</CardTitle>
        <CardDescription>Across all branches.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-heading-40 tabular-nums">1,284</p>
      </CardContent>
    </Card>
  ),
};
