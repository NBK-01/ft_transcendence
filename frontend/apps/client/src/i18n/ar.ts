import type { ClientResources } from "./en";

const ar: ClientResources = {
  pages: {
    shipments: "تتبّع كل طرد أرسلته، مباشرةً.",
    messages: "تواصل مع الدعم وفرعك بخصوص شحنة.",
    notifications: "كل تغيير في الحالة وكل رد، في مكان واحد.",
    profile: "بياناتك وصورتك وجهات اتصالك.",
  },
  shipments: {
    listLabel: "شحناتك",
    columns: { trackingId: "رقم التتبع", route: "المسار", status: "الحالة", updatedAt: "آخر تحديث" },
    emptyTitle: "لا توجد شحنات بعد",
    emptyBody: "ستظهر هنا الشحنات التي ترسلها مع حالتها المباشرة.",
    newShipment: "شحنة جديدة",
    errorTitle: "تعذّر تحميل شحناتك",
    errorBody: "تحقّق من اتصالك وحاول مرة أخرى.",
    retry: "إعادة المحاولة",
    searchLabel: "البحث برقم التتبع",
    searchPlaceholder: "رقم التتبع، مثل TRK-8F3A21",
    statusLabel: "التصفية حسب الحالة",
    allStatuses: "كل الحالات",
    noMatchTitle: "لا توجد شحنات مطابقة",
    noMatchBody: "جرّب رقم تتبع أو حالة أخرى.",
    clearFilters: "مسح عوامل التصفية",
    backToList: "كل الشحنات",
    eyebrow: "شحنة",
    copyTrackingId: "نسخ رقم التتبع",
    copyFailed: "تعذّر النسخ. حدّد رقم التتبع وانسخه يدويًا.",
    notFoundTitle: "الشحنة غير موجودة",
    notFoundBody: "لا توجد شحنة برقم التتبع {{id}} في حسابك.",
    detailErrorTitle: "تعذّر تحميل هذه الشحنة",
    tabs: { timeline: "المسار الزمني" },
    timelineLabel: "سجل الشحنة",
    timelineEmpty: "لا توجد تحديثات بعد",
    timelineErrorTitle: "تعذّر تحميل المسار الزمني",
  },
};

export default ar;
