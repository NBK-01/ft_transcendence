import { useTranslation } from "react-i18next";

import { useActivityTime } from "../messages/use-activity-time";

/** "14:05", "Yesterday" or "12 Oct", like the messages list, with the full date and time on hover. */
export function LastUpdate({ at }: { at: string }) {
  const { i18n } = useTranslation();
  const activityTime = useActivityTime();
  const full = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { dateStyle: "medium", timeStyle: "short" });
  return (
    <time dateTime={at} title={full.format(new Date(at))}>
      {activityTime(at)}
    </time>
  );
}
