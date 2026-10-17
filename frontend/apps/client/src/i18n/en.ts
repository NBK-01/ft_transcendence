/** Client-only strings (namespace "app"). Shared strings live in @trans/ui (namespace "common"). */
const en = {
  profile: {
    edit: "Edit profile",
    saved: "Profile saved",
    retry: "Try again",
    notSet: "Not set",
    verified: "Verified email",
    addPhoto: "Add photo",
    changePhoto: "Change photo",
    uploading: "Uploading… {{percent}}%",
    avatarUpdated: "Photo updated",
    photoHint: "JPG, PNG or WebP, 2 MB max.",
    emailHint: "Your sign-in email can't be changed here.",
    phoneHint: "With country code, e.g. +961 70 123 456.",
    fields: {
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      dateOfBirth: "Date of birth",
      phoneNumber: "Phone number",
    },
    errors: {
      loadTitle: "Couldn't load your profile",
      loadBody: "Check your connection and try again.",
      save: "Couldn't save your profile. Try again.",
      avatarType: "Choose a JPG, PNG or WebP image.",
      avatarSize: "The photo must be 2 MB or less.",
      avatarUpload: "Couldn't upload the photo. Try again.",
      dateOfBirth: "Enter a real date in the past.",
      phone: "Enter a number with its country code, e.g. +961 70 123 456.",
    },
  },
  pages: {
    shipments: "Track every parcel you've sent, live.",
    messages: "Talk to support and your branch about a shipment.",
    notifications: "Every status change and reply, in one feed.",
    profile: "Your photo and personal details.",
  },
};

export default en;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type ClientResources = Widen<typeof en>;
