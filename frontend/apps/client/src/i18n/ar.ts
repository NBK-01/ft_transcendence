import type { ClientResources } from "./en";

const ar: ClientResources = {
  profile: {
    edit: "تعديل الملف الشخصي",
    saved: "تم حفظ الملف الشخصي",
    retry: "إعادة المحاولة",
    notSet: "غير محدد",
    verified: "بريد إلكتروني موثّق",
    addPhoto: "إضافة صورة",
    changePhoto: "تغيير الصورة",
    uploading: "جارٍ الرفع… {{percent}}٪",
    avatarUpdated: "تم تحديث الصورة",
    photoHint: "JPG أو PNG أو WebP، بحد أقصى 2 ميغابايت.",
    emailHint: "لا يمكن تغيير بريد تسجيل الدخول هنا.",
    phoneHint: "مع رمز الدولة، مثل +961 70 123 456.",
    fields: {
      firstName: "الاسم الأول",
      lastName: "اسم العائلة",
      email: "البريد الإلكتروني",
      dateOfBirth: "تاريخ الميلاد",
      phoneNumber: "رقم الهاتف",
    },
    errors: {
      loadTitle: "تعذّر تحميل ملفك الشخصي",
      loadBody: "تحقّق من اتصالك وحاول مرة أخرى.",
      save: "تعذّر حفظ ملفك الشخصي. حاول مرة أخرى.",
      avatarType: "اختر صورة بصيغة JPG أو PNG أو WebP.",
      avatarSize: "يجب ألا يتجاوز حجم الصورة 2 ميغابايت.",
      avatarUpload: "تعذّر رفع الصورة. حاول مرة أخرى.",
      dateOfBirth: "أدخل تاريخًا حقيقيًا في الماضي.",
      phone: "أدخل رقمًا مع رمز الدولة، مثل +961 70 123 456.",
    },
  },
  pages: {
    shipments: "تتبّع كل طرد أرسلته، مباشرةً.",
    messages: "تواصل مع الدعم وفرعك بخصوص شحنة.",
    notifications: "كل تغيير في الحالة وكل رد، في مكان واحد.",
    profile: "صورتك وبياناتك الشخصية.",
  },
};

export default ar;
