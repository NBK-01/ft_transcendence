import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@trans/ui/components/tabs";

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: { defaultValue: "timeline" },
  render: (args) => (
    <Tabs {...args} className="w-[32rem] max-w-[calc(100vw-2rem)]">
      <TabsList>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
        <TabsTrigger value="audit" disabled>
          Audit log
        </TabsTrigger>
      </TabsList>
      <TabsContent value="timeline" className="text-copy-14 text-gray-900">
        Every status change, with who made it and when.
      </TabsContent>
      <TabsContent value="files" className="text-copy-14 text-gray-900">
        Package photos and proof of delivery.
      </TabsContent>
      <TabsContent value="messages" className="text-copy-14 text-gray-900">
        Conversation with support about this shipment.
      </TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SecondTab: Story = { args: { defaultValue: "files" } };
