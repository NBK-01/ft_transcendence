import { ArrowLeft, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
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
import { PhotoPicker } from "../features/shipments/photo-picker";

type Mode = "link" | "photos";

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/** /app/shipment/new — ask for a product by link or by photos. Becomes a pending_sourcing order. */
export function NewShipmentPage() {
  const { t } = useTranslation(["common", "app"]);
  const navigate = useNavigate();
  const create = useCreateShipment();

  const [mode, setMode] = useState<Mode>("link");
  const [productUrl, setProductUrl] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<{ field?: Mode; message: string } | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);

    if (mode === "link") {
      const url = productUrl.trim();
      if (!url) return setError({ field: "link", message: "app:shipments.newForm.urlRequired" });
      if (!isHttpUrl(url)) return setError({ field: "link", message: "app:shipments.newForm.urlInvalid" });
    } else if (photos.length === 0) {
      return setError({ field: "photos", message: "app:shipments.newForm.photosRequired" });
    }

    create.mutate(mode === "link" ? { productUrl: productUrl.trim() } : { images: photos }, {
      onSuccess: (shipment) => {
        toast.success(t("app:shipments.newForm.sent", { id: shipment.trackingId }));
        void navigate(`/app/shipment/${encodeURIComponent(shipment.trackingId)}`);
      },
      onError: (err) =>
        // The backend's messages are already translated (Accept-Language).
        setError({ message: isApiError(err) && err.messages[0] ? err.messages[0] : "app:shipments.errorBody" }),
    });
  };

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
            <Field
              label={t("app:shipments.newForm.urlLabel")}
              hint={t("app:shipments.newForm.urlHint")}
              error={error?.field === "link" ? error.message : undefined}
            >
              <Input
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                dir="ltr"
                value={productUrl}
                onChange={(event) => setProductUrl(event.target.value)}
              />
            </Field>
          </TabsContent>
          <TabsContent value="photos" forceMount className="data-[state=inactive]:hidden">
            <PhotoPicker onChange={setPhotos} error={error?.field === "photos" ? error.message : undefined} />
          </TabsContent>
        </Tabs>

        <p className="flex items-start gap-2 rounded-lg bg-background-200 px-3 py-2.5 text-copy-13 text-gray-900">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t("app:shipments.newForm.whatNext")}
        </p>

        {error && !error.field && <FieldError message={error.message} />}

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
