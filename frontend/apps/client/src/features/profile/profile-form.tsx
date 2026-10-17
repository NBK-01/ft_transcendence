import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { isApiError } from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { toast } from "@trans/ui/components/toaster";

import { useUpdateProfile } from "./api";
import { namesOf } from "./names";
import type { Profile } from "./types";
import { dateOfBirthError, nameError, phoneError } from "./validation";

type Values = { firstName: string; lastName: string; dateOfBirth: string; phoneNumber: string };
type Errors = Partial<Record<keyof Values | "form", string>>;

/** Today as "YYYY-MM-DD" in local time, for the date input's `max`. */
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Edit mode: change names, birth date and phone. Email is shown but can't be changed here. */
export function ProfileForm({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const save = useUpdateProfile();

  const [values, setValues] = useState<Values>(() => ({
    ...namesOf(profile),
    dateOfBirth: profile.dateOfBirth ?? "",
    phoneNumber: profile.phoneNumber ?? "",
  }));
  const [errors, setErrors] = useState<Errors>({});

  const set = (field: keyof Values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {
      firstName: nameError(values.firstName),
      lastName: nameError(values.lastName),
      dateOfBirth: dateOfBirthError(values.dateOfBirth),
      phoneNumber: phoneError(values.phoneNumber),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    save.mutate(
      {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dateOfBirth: values.dateOfBirth || null,
        phoneNumber: values.phoneNumber.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(t("app:profile.saved"));
          onDone();
        },
        onError: (err) =>
          setErrors({ form: isApiError(err) && err.messages[0] ? err.messages[0] : "app:profile.errors.save" }),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("app:profile.fields.firstName")} error={errors.firstName}>
          <Input autoComplete="given-name" value={values.firstName} onChange={set("firstName")} />
        </Field>
        <Field label={t("app:profile.fields.lastName")} error={errors.lastName}>
          <Input autoComplete="family-name" value={values.lastName} onChange={set("lastName")} />
        </Field>
        <Field label={t("app:profile.fields.email")} hint={t("app:profile.emailHint")}>
          <Input type="email" value={profile.email} disabled dir="ltr" />
        </Field>
        <Field label={t("app:profile.fields.dateOfBirth")} error={errors.dateOfBirth}>
          <Input
            type="date"
            autoComplete="bday"
            min="1900-01-01"
            max={todayIso()}
            value={values.dateOfBirth}
            onChange={set("dateOfBirth")}
          />
        </Field>
        <Field label={t("app:profile.fields.phoneNumber")} hint={t("app:profile.phoneHint")} error={errors.phoneNumber}>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+961 70 123 456"
            dir="ltr"
            value={values.phoneNumber}
            onChange={set("phoneNumber")}
          />
        </Field>
      </div>

      {errors.form && <FieldError message={errors.form} />}

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
