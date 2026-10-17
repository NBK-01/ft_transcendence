import { FileCheck2, FileImage, FileText, Paperclip, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useShipmentFiles } from "./api";
import { formatFileSize } from "./format";
import { formatAbsolute } from "./format-time";
import type { ShipmentFile } from "./types";

const ICON: Record<ShipmentFile["kind"], LucideIcon> = {
  package_photo: FileImage,
  proof_of_delivery: FileCheck2,
  other: FileText,
};

/** Files tab: photos, proof of delivery and other attachments, each opened in a new tab. View only. */
export function ShipmentFiles({ trackingId }: { trackingId: string }) {
  const { t, i18n } = useTranslation(["common", "app"]);
  const { data: files, isPending, isError, refetch, isFetching } = useShipmentFiles(trackingId);

  if (isPending) return <FilesSkeleton />;

  if (isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title={t("app:shipments.files.errorTitle")}
        description={t("app:shipments.errorBody")}
        action={
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            {t("app:shipments.retry")}
          </Button>
        }
      />
    );
  }

  if (files.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title={t("app:shipments.files.emptyTitle")}
        description={t("app:shipments.files.emptyBody")}
      />
    );
  }

  return (
    <Card className="max-w-2xl overflow-hidden">
      <ul aria-label={t("app:shipments.tabs.files")} className="divide-y divide-gray-alpha-400">
        {files.map((file) => {
          const Icon = ICON[file.kind];
          return (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-gray-alpha-400 bg-background-200">
                <Icon aria-hidden="true" className="size-4 text-gray-900" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-label-14 text-gray-1000" dir="ltr">
                  {file.name}
                </span>
                <span className="truncate text-label-13 text-gray-900">
                  {t(`app:shipments.files.kind.${file.kind}`)} · {formatFileSize(file.sizeBytes, i18n.language)} ·{" "}
                  <time dateTime={file.uploadedAt}>{formatAbsolute(file.uploadedAt, i18n.language)}</time>
                </span>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  {t("app:shipments.files.open")}
                  <span className="sr-only">: {file.name}</span>
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function FilesSkeleton() {
  return (
    <Card aria-busy="true" className="max-w-2xl overflow-hidden">
      <ul className="divide-y divide-gray-alpha-400">
        {Array.from({ length: 2 }, (_, index) => (
          <li key={index} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-16" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
