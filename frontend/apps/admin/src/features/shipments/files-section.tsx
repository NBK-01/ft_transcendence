import { FileCheck2, FileImage, FileText, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAdminShipmentFiles, type AttachmentKind } from "@trans/api";
import { Skeleton } from "@trans/ui/components/skeleton";

import { DetailSection, NewTabLink, SectionError } from "./detail-parts";
import { useDetailFormat } from "./use-detail-format";

const ICON: Record<AttachmentKind, LucideIcon> = {
  package_photo: FileImage,
  proof_of_delivery: FileCheck2,
  other: FileText,
};

/**
 * Package photos, proof of delivery and other attachments, newest first, each
 * opened in a new tab. Request and offer photos aren't here: the API lists
 * them with the request and the offer.
 */
export function FilesSection({ trackingId }: { trackingId: string }) {
  const { t } = useTranslation("app");
  const format = useDetailFormat();
  const files = useAdminShipmentFiles(trackingId);

  return (
    <DetailSection title={t("shipment.files.title")}>
      {files.isPending ? (
        <FilesSkeleton />
      ) : files.isError ? (
        <SectionError
          message={t("shipment.files.error")}
          onRetry={() => void files.refetch()}
          retrying={files.isFetching}
        />
      ) : files.data.length === 0 ? (
        <p className="text-copy-14 text-gray-900">{t("shipment.files.empty")}</p>
      ) : (
        <ul className="-my-3 divide-y divide-gray-alpha-400">
          {files.data.map((file) => {
            const Icon = ICON[file.kind];
            return (
              <li key={file.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-gray-alpha-400 bg-background-200">
                  <Icon aria-hidden="true" className="size-4 text-gray-900" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <NewTabLink href={file.url} className="w-fit text-label-14">
                    <bdi>{file.name}</bdi>
                  </NewTabLink>
                  <span className="truncate text-label-13 text-gray-900">
                    {t(`shipment.files.kind.${file.kind}`)} · {format.fileSize(file.sizeBytes)} ·{" "}
                    <time dateTime={file.uploadedAt}>{format.dateTime(file.uploadedAt)}</time>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DetailSection>
  );
}

function FilesSkeleton() {
  const { t } = useTranslation("common");
  return (
    <div aria-busy="true">
      <span className="sr-only">{t("table.loading")}</span>
      <ul aria-hidden="true" className="flex flex-col gap-4">
        {Array.from({ length: 2 }, (_, index) => (
          <li key={index} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
