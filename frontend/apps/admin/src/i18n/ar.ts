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
    newAccount: "حساب موظف جديد",
    rowActions: "إجراءات {{name}}",
    edit: "تعديل",
    form: {
      createTitle: "حساب موظف جديد",
      createDescription: "يسجّل الموظف الدخول إلى لوحة الإدارة بهذا البريد وكلمة المرور.",
      editTitle: "تعديل {{name}}",
      editDescription: "غيّر الاسم أو الدور أو الفرع.",
      name: "الاسم الكامل",
      email: "البريد الإلكتروني",
      emailLocked: "لا يمكن تغيير البريد الإلكتروني.",
      password: "كلمة مرور مؤقتة",
      passwordHint: "8 أحرف على الأقل، تتضمن حرفًا ورقمًا. شاركها مع الموظف بطريقة آمنة.",
      role: "الدور",
      rolePlaceholder: "اختر دورًا",
      branch: "الفرع",
      create: "إنشاء الحساب",
      created: "تمت إضافة {{name}}",
      updated: "تم تحديث {{name}}",
      error: "تعذّر الحفظ. حاول مرة أخرى.",
    },
  },
};

export default ar;
