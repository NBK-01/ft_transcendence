import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { AvatarUploader } from "@trans/ui/blocks/avatar-uploader";

const PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
      '<rect width="64" height="64" fill="#0a72ef"/><circle cx="32" cy="26" r="11" fill="#fff"/>',
      '<rect x="14" y="42" width="36" height="22" rx="11" fill="#fff"/></svg>',
    ].join(""),
  );

const meta = {
  title: "Blocks/AvatarUploader",
  component: AvatarUploader,
  tags: ["autodocs"],
  args: { name: "Rami Khoury", onSelect: fn(), onRemove: fn() },
} satisfies Meta<typeof AvatarUploader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No photo yet: initials and "Add photo". A GIF or a file over 2 MB is refused before upload. */
export const NoPhoto: Story = {};

export const WithPhoto: Story = { args: { src: PHOTO } };

export const Uploading: Story = { args: { src: PHOTO, progress: 0.42 } };

export const Removing: Story = { args: { src: PHOTO, removing: true } };

/** The backend refused it; its message is already translated. */
export const Failed: Story = { args: { error: "Couldn't upload the photo. Try again." } };

/** Pick a file: it "uploads" over a second and a half, then shows. */
export const Interactive: Story = {
  render: function Render(args) {
    const [src, setSrc] = useState<string | null>(null);
    const [progress, setProgress] = useState<number>();
    const upload = (file: File) => {
      let done = 0;
      const timer = setInterval(() => {
        done += 0.1;
        if (done < 1) return setProgress(done);
        clearInterval(timer);
        setProgress(undefined);
        setSrc(URL.createObjectURL(file));
      }, 150);
      setProgress(0);
    };
    return <AvatarUploader {...args} src={src} progress={progress} onSelect={upload} onRemove={() => setSrc(null)} />;
  },
};
