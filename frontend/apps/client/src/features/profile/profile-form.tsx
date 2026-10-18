import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { isApiError } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { toast } from "@trans/ui/components/toaster";
import { profileSchema, type ProfileValues } from "@trans/ui/schemas/profile";

import { useUpdateProfile } from "./api";
import { namesOf } from "./names";
import type { Profile } from "./types";

/** Today as "YYYY-MM-DD" in local time, for the date input's `max`. */
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Edit mode: change names, birth date and phone. Email is shown but can't be changed here. */
export function ProfileForm({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const save = useUpdateProfile();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      ...namesOf(profile),
      dateOfBirth: profile.dateOfBirth ?? "",
      phoneNumber: profile.phoneNumber ?? "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async ({ firstName, lastName, dateOfBirth, phoneNumber }) => {
    try {
      // null clears an optional field.
      await save.mutateAsync({ firstName, lastName, dateOfBirth: dateOfBirth || null, phoneNumber: phoneNumber || null });
      toast.success(t("app:profile.saved"));
      onDone();
    } catch (error) {
      form.setError("root", {
        message: isApiError(error) && error.messages[0] ? error.messages[0] : "app:profile.errors.save",
      });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("app:profile.fields.firstName")} error={errors.firstName?.message}>
          <Input autoComplete="given-name" {...form.register("firstName")} />
        </Field>
        <Field label={t("app:profile.fields.lastName")} error={errors.lastName?.message}>
          <Input autoComplete="family-name" {...form.register("lastName")} />
        </Field>
        <Field label={t("app:profile.fields.email")} hint={t("app:profile.emailHint")}>
          <Input type="email" value={profile.email} disabled dir="ltr" />
        </Field>
        <Field label={t("app:profile.fields.dateOfBirth")} error={errors.dateOfBirth?.message}>
          <Input
            type="date"
            autoComplete="bday"
            min="1900-01-01"
            max={todayIso()}
            {...form.register("dateOfBirth")}
          />
        </Field>
        <Field label={t("app:profile.fields.phoneNumber")} hint={t("app:profile.phoneHint")} error={errors.phoneNumber?.message}>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+961 70 123 456"
            dir="ltr"
            {...form.register("phoneNumber")}
          />
        </Field>
      </div>

      {errors.root?.message && <FieldError message={errors.root.message} />}

      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          {t("actions.save")}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
