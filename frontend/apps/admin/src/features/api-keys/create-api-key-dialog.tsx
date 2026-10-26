import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useState, type RefObject } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  API_KEY_BRANCH_INACTIVE,
  isApiError,
  isForbidden,
  useCreateApiKey,
  type CreatedApiKey,
} from "@trans/api";
import { Button } from "@trans/ui/components/button";
import { CopyButton } from "@trans/ui/components/copy-button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trans/ui/components/dialog";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";
import { apiKeySchema, type ApiKeyValues } from "@trans/ui/schemas/api-key";

import { useOrganizations } from "../branches/api";

/**
 * Creates a key, then shows it in full, once. The content mounts with the
 * dialog, so the key lives only in its state and is gone when it closes; it
 * never reaches the query cache. While the key is shown, neither a click
 * outside nor Escape closes the dialog, so it isn't lost by accident: only
 * "I've copied it" does.
 */
export function CreateApiKeyDialog({
  open,
  onOpenChange,
  defaultBranchId,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The topbar's branch, if one is picked. */
  defaultBranchId?: string | null;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ApiKeyDialogContent
        defaultBranchId={defaultBranchId}
        returnFocusTo={returnFocusTo}
        onDone={() => onOpenChange(false)}
      />
    </Dialog>
  );
}

function ApiKeyDialogContent({
  defaultBranchId,
  returnFocusTo,
  onDone,
}: {
  defaultBranchId?: string | null;
  returnFocusTo?: RefObject<HTMLElement | null>;
  onDone: () => void;
}) {
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  return (
    <DialogContent
      className="max-w-lg"
      onCloseAutoFocus={focusOnClose(returnFocusTo)}
      onInteractOutside={(event) => created && event.preventDefault()}
      onEscapeKeyDown={(event) => created && event.preventDefault()}
    >
      {created ? (
        <CreatedKey apiKey={created} onDone={onDone} />
      ) : (
        <CreateForm defaultBranchId={defaultBranchId} onCreated={setCreated} />
      )}
    </DialogContent>
  );
}

function CreateForm({
  defaultBranchId,
  onCreated,
}: {
  defaultBranchId?: string | null;
  onCreated: (apiKey: CreatedApiKey) => void;
}) {
  const { t } = useTranslation(["common", "app"]);
  const create = useCreateApiKey();
  const organizations = useOrganizations();
  const activeBranches = (organizations.data ?? []).filter((org) => org.isActive);
  const form = useForm<ApiKeyValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
      // Only an active branch can hold a key.
      organizationId: activeBranches.some((org) => org.id === defaultBranchId) ? defaultBranchId! : "",
    },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      onCreated(await create.mutateAsync(values));
    } catch (error) {
      if (isApiError(error) && error.errorCode === API_KEY_BRANCH_INACTIVE) {
        form.setError("organizationId", { message: "app:apiKeys.form.branchInactive" }, { shouldFocus: true });
      } else {
        form.setError("root", {
          // A 403: the role changed since signing in (the backend's message is English-only).
          message: isForbidden(error)
            ? t("app:noAccess.action")
            : isApiError(error) && error.messages[0]
              ? error.messages[0]
              : t("app:apiKeys.form.error"),
        });
      }
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("app:apiKeys.form.createTitle")}</DialogTitle>
        <DialogDescription>{t("app:apiKeys.form.createDescription")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate>
        <DialogBody className="flex flex-col gap-5">
          <Field label={t("app:apiKeys.form.name")} hint={t("app:apiKeys.form.nameHint")} error={errors.name?.message}>
            <Input autoComplete="off" maxLength={100} autoFocus {...form.register("name")} />
          </Field>
          {/* The Field sits inside <Select> so its label and error reach the trigger (as in the staff form). */}
          <Controller
            control={form.control}
            name="organizationId"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <Field label={t("app:apiKeys.form.branch")} error={errors.organizationId?.message}>
                  <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
                    <SelectValue placeholder={t("app:apiKeys.form.branchPlaceholder")} />
                  </SelectTrigger>
                </Field>
                <SelectContent>
                  {activeBranches.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={create.isPending}>
              {t("actions.cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" loading={create.isPending}>
            {t("app:apiKeys.form.create")}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function CreatedKey({ apiKey, onDone }: { apiKey: CreatedApiKey; onDone: () => void }) {
  const { t } = useTranslation("app");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("apiKeys.created.title")}</DialogTitle>
        <DialogDescription>
          {t("apiKeys.created.description", { name: apiKey.name, branch: apiKey.organization.name })}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <p
          role="note"
          className="flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-100/40 p-3 text-copy-14 text-gray-1000"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-900" aria-hidden="true" />
          {t("apiKeys.created.warning")}
        </p>
        <div className="flex flex-col gap-2">
          {/* Field gives its own child the label's id, so the copy button sits beside it, not inside. */}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label={t("apiKeys.created.label")}>
                {/* Read-only and selected on focus, so it can also be copied by hand. */}
                {/* Focused when it appears (the submit button is gone), so screen readers reach it at once. */}
                <Input
                  readOnly
                  autoFocus
                  value={apiKey.key}
                  dir="ltr"
                  className="font-mono text-copy-13"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </Field>
            </div>
            <CopyButton value={apiKey.key} label={t("apiKeys.created.copy")} />
          </div>
          <p className="text-label-12 text-gray-900">{t("apiKeys.created.usage")}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone}>{t("apiKeys.created.done")}</Button>
      </DialogFooter>
    </>
  );
}
