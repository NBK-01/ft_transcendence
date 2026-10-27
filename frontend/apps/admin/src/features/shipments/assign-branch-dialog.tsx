import { zodResolver } from "@hookform/resolvers/zod";
import type { RefObject } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import {
  isApiError,
  ORGANIZATION_INACTIVE,
  SHIPMENT_BRANCH_LOCKED,
  useAssignShipmentBranch,
  type AdminShipmentDetail,
} from "@trans/api";
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
} from "@trans/ui/components/dialog";
import { Field, FieldError } from "@trans/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";
import { toast } from "@trans/ui/components/toaster";
import { focusOnClose } from "@trans/ui/hooks/use-return-focus";

import { useOrganizations } from "../branches/api";
import { actionError } from "./action-error";

/** The Select's value for "no branch" (a Select item can't have an empty value). */
const NONE = "none";

const schema = z.object({ branch: z.string().min(1, { error: "validation.required" }) });
type Values = z.infer<typeof schema>;

/**
 * Hand a customer's order to a branch, or take it off one, so the branch's
 * dispatchers work on it. Admins only (organizations:manage). Only active
 * branches are offered; the form mounts with the dialog, so it starts from
 * the shipment's current branch every time it opens.
 */
export function AssignBranchDialog({
  open,
  onOpenChange,
  shipment,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: AdminShipmentDetail;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("app");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onCloseAutoFocus={focusOnClose(returnFocusTo)}>
        <DialogHeader>
          <DialogTitle>{t("shipment.assignBranch.title", { trackingId: shipment.trackingId })}</DialogTitle>
          <DialogDescription>{t("shipment.assignBranch.description")}</DialogDescription>
        </DialogHeader>
        <AssignBranchForm shipment={shipment} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AssignBranchForm({ shipment, onDone }: { shipment: AdminShipmentDetail; onDone: () => void }) {
  const { t } = useTranslation(["common", "app"]);
  const assign = useAssignShipmentBranch();
  const branches = (useOrganizations().data ?? []).filter(
    (org) => org.isActive || org.id === shipment.organization?.id,
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { branch: shipment.organization?.id ?? NONE },
  });

  const submit = form.handleSubmit(async ({ branch }) => {
    try {
      await assign.mutateAsync({ trackingId: shipment.trackingId, organizationId: branch === NONE ? null : branch });
      toast.success(t("app:shipment.assignBranch.saved"));
      onDone();
    } catch (error) {
      const code = isApiError(error) ? error.errorCode : undefined;
      form.setError("root", {
        message:
          code === SHIPMENT_BRANCH_LOCKED
            ? t("app:shipment.assignBranch.locked")
            : code === ORGANIZATION_INACTIVE
              ? t("app:shipment.assignBranch.inactive")
              : actionError(error, t, "app:shipment.assignBranch.error"),
      });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogBody className="flex flex-col gap-5">
        <Controller
          control={form.control}
          name="branch"
          // Field wraps the trigger alone: the label and the error attach to it.
          render={({ field, fieldState }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <Field label={t("app:shipment.assignBranch.label")} error={fieldState.error?.message}>
                <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
              </Field>
              <SelectContent>
                <SelectItem value={NONE}>{t("app:shipment.assignBranch.none")}</SelectItem>
                {branches.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {form.formState.errors.root?.message && (
          <FieldError className="whitespace-pre-line">{form.formState.errors.root.message}</FieldError>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" disabled={assign.isPending}>
            {t("actions.cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" loading={assign.isPending}>
          {t("app:shipment.assignBranch.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
