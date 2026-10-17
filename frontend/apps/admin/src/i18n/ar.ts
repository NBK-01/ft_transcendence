import type { AdminResources } from "./en";

const ar: AdminResources = {
  logoLabel: "الإدارة",
  groups: {
    operations: "العمليات",
    manage: "الإدارة",
  },
  pages: {
    dashboard: "عرض مباشر للشحنات والفروع والموظفين.",
    shipments: "كل الشحنات في الفروع التي يمكنك الوصول إليها.",
    messages: "المحادثات بين الموظفين والعملاء.",
    users: "حسابات الموظفين: الأدوار والفروع وصلاحية الدخول.",
    branches: "الفروع هي المؤسسات: الأعضاء والعنوان والشحنات.",
    apiKeys: "مفاتيح تتيح للأنظمة الشريكة استخدام الواجهة البرمجية العامة.",
    profile: "بيانات حسابك.",
  },
  users: {
    columns: { name: "الاسم", role: "الدور", branch: "الفرع", status: "الحالة", created: "تاريخ الإنشاء" },
    roles: { admin: "مسؤول", dispatcher: "مُوزِّع", driver: "سائق", support: "دعم", none: "بدون دور" },
    status: { active: "نشط", deactivated: "معطّل" },
    noBranch: "بدون فرع",
    search: "ابحث بالاسم أو البريد الإلكتروني…",
    emptyTitle: "لا توجد حسابات موظفين بعد",
    emptyBody: "ستظهر هنا حسابات الموظفين التي تنشئها.",
  },
};

export default ar;
