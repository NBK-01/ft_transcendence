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
  },
};

export default ar;
