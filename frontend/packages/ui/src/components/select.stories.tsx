import type { Meta, StoryObj } from "@storybook/react-vite";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@trans/ui/components/select";

const BRANCHES = ["Casablanca — Maârif", "Rabat — Agdal", "Paris — 11e", "Lyon — Part-Dieu"];

const meta = {
  title: "Components/Forms/Select",
  component: Select,
  tags: ["autodocs"],
  render: (args) => (
    <div className="w-72">
      <Select {...args}>
        <SelectTrigger aria-label="Branch">
          <SelectValue placeholder="Choose a branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Branches</SelectLabel>
            {BRANCHES.map((branch) => (
              <SelectItem key={branch} value={branch}>
                {branch}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};
export const WithValue: Story = { args: { defaultValue: "Paris — 11e" } };
export const Disabled: Story = { args: { disabled: true } };
