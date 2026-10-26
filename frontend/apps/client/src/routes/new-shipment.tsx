import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { isApiError } from "@trans/api";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import { Field, FieldError } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@trans/ui/components/tabs";
import { toast } from "@trans/ui/components/toaster";

import { useCreateShipment } from "../features/shipments/api";
import { newShipmentLinkSchema, type NewShipmentLinkValues } from "../features/shipments/new-shipment-schema";
import { PhotoPicker } from "../features/shipments/photo-picker";

type Mode = "link" | "photos";

/** /app/shipments/new — ask for a product by link or by photos. Becomes a pending_sourcing order. */
export function NewShipmentPage() {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const create = useCreateShipment();

  const [mode, setMode] = useState<Mode>("link");
  const [photos, setPhotos] = useState<File[]>([]);
  // "By photos" has no text input, so it's not worth its own react-hook-form instance:
  // one state for the picker's own "required" validation, one for a submit-time API error.
  const [photosFieldError, setPhotosFieldError] = useState<string>();
  const [photosFormError, setPhotosFormError] = useState<string>();

  const form = useForm<NewShipmentLinkValues>({
    resolver: zodResolver(newShipmentLinkSchema),
    defaultValues: { productUrl: "" },
  });
  const { errors } = form.formState;

  const onSuccess = (shipment: { trackingId: string }) => {
    toast.success(t("app:shipments.newForm.sent", { id: shipment.trackingId }));
    void navigate(`/app/shipments/${encodeURIComponent(shipment.trackingId)}`);
  };
  // The backend's messages are already translated (Accept-Language).
  const apiErrorMessage = (err: unknown) => (isApiError(err) && err.messages[0] ? err.messages[0] : "app:shipments.errorBody");

  const submitLink = form.handleSubmit((values) => {
    create.mutate(
      { productUrl: values.productUrl.trim() },
      { onSuccess, onError: (err) => form.setError("root", { message: apiErrorMessage(err) }) },
    );
  });

  const submitPhotos = (event: FormEvent) => {
    event.preventDefault();
    setPhotosFieldError(undefined);
    setPhotosFormError(undefined);
    if (photos.length === 0) return setPhotosFieldError("app:shipments.newForm.photosRequired");
    create.mutate({ images: photos }, { onSuccess, onError: (err) => setPhotosFormError(apiErrorMessage(err)) });
  };

  const submit = mode === "link" ? submitLink : submitPhotos;

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("app:shipments.newShipment")} · ${t("brand.name")}`}</title>

      <Link
        to="/app"
        className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-md text-label-14 text-gray-900 hover:text-gray-1000"
      >
        <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
        {t("app:shipments.backToList")}
      </Link>

      <PageHeader title={t("app:shipments.newShipment")} description={t("app:shipments.newForm.description")} />

      <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-6">
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList aria-label={t("app:shipments.newForm.modeLabel")}>
            <TabsTrigger value="link">{t("app:shipments.newForm.byLink")}</TabsTrigger>
            <TabsTrigger value="photos">{t("app:shipments.newForm.byPhotos")}</TabsTrigger>
          </TabsList>
          <TabsContent value="link" forceMount className="data-[state=inactive]:hidden">
            <Field label={t("app:shipments.newForm.urlLabel")} hint={t("app:shipments.newForm.urlHint")} error={errors.productUrl?.message}>
              <Input type="url" inputMode="url" autoComplete="url" placeholder="https://" dir="ltr" {...form.register("productUrl")} />
            </Field>
          </TabsContent>
          <TabsContent value="photos" forceMount className="data-[state=inactive]:hidden">
            <PhotoPicker onChange={setPhotos} error={photosFieldError} />
          </TabsContent>
        </Tabs>

        <p className="flex items-start gap-2 rounded-lg bg-background-200 px-3 py-2.5 text-copy-13 text-gray-900">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("app:shipments.newForm.whatNext")}
        </p>

        {mode === "link" && errors.root?.message && <FieldError message={errors.root.message} />}
        {mode === "photos" && photosFormError && <FieldError message={photosFormError} />}

        <div className="flex gap-2">
          <Button type="submit" variant="accent" loading={create.isPending}>
            {t("app:shipments.newForm.submit")}
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/app">{t("actions.cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
