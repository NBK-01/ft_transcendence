/**
 * English — source of truth for the shared `common` namespace.
 * fr.ts and ar.ts are typed against this shape, so a missing key is a
 * type error, not a silent fallback.
 */
const en = {
  brand: {
    name: "ShipTrack",
    tagline: "Shipping operations, in real time.",
  },
  actions: {
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
    continue: "Continue",
    delete: "Delete",
    save: "Save changes",
    copy: "Copy",
    copied: "Copied",
  },
  status: {
    requested: "Requested",
    confirmed: "Confirmed",
    in_transit: "In transit",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  },
  nav: {
    main: "Main navigation",
    home: "Home",
    shipments: "Shipments",
    chat: "Messages",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings",
    dashboard: "Overview",
    users: "Users",
    branches: "Branches",
    apiKeys: "API keys",
    search: "Search",
    searchPlaceholder: "Search…",
    signOut: "Sign out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    toggleSidebar: "Toggle sidebar",
    account: "Account",
    allBranches: "All branches",
    branch: "Branch",
    more: "More",
    skipToContent: "Skip to content",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  language: {
    label: "Language",
    en: "English",
    fr: "Français",
    ar: "العربية",
  },
  footer: {
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    status: "All systems normal",
    rights: "© {{year}} ShipTrack. Built as part of the 42 curriculum.",
    legal: "Legal",
  },
  auth: {
    signInTitle: "Sign in to ShipTrack",
    signInSubtitle: "Track shipments and talk to your branch in real time.",
    adminSignInTitle: "Sign in to ShipTrack Admin",
    adminSignInSubtitle: "Staff and administrators only.",
    signUpTitle: "Create your account",
    signUpSubtitle: "Ship, track and get notified on every step.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    confirmPassword: "Confirm password",
    firstName: "First name",
    lastName: "Last name",
    forgotPassword: "Forgot password?",
    signIn: "Sign in",
    signUp: "Create account",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    acceptTerms: "I agree to the <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    passwordHint: "8+ characters, with a number and a letter.",
    twoFactorTitle: "Two-factor authentication",
    twoFactorSubtitle: "Enter the 6-digit code from your authenticator app.",
    code: "Verification code",
    verify: "Verify",
    resend: "Resend code",
    resendIn: "Resend code in {{seconds}}s",
    useBackupCode: "Use a backup code instead",
    backToSignIn: "Back to sign in",
    mockSignedIn: "Signed in (preview — no backend yet).",
    mockSignedUp: "Account created (preview — no backend yet).",
    mockVerified: "Code accepted (preview — no backend yet).",
    mockResent: "A new code was sent (preview).",
    panelTitle: "Every hand-off, visible.",
    panelBody: "Customers, dispatchers and drivers see the same shipment, updated the moment it moves.",
    panelLive: "Live",
    panelTracking: "Tracking",
    or: "or",
  },
  validation: {
    required: "This field is required.",
    email: "Enter a valid email address.",
    passwordMin: "Use at least 8 characters.",
    passwordStrength: "Include at least one letter and one number.",
    passwordMatch: "Passwords don't match.",
    nameMax: "Keep it under 50 characters.",
    otp: "Enter all 6 digits.",
    terms: "You need to accept the terms to continue.",
  },
  empty: {
    comingSoonTitle: "Nothing here yet",
    comingSoonBody: "This section is part of the next milestone. The layout is ready; data arrives once the API is wired.",
    backHome: "Back to overview",
  },
  table: {
    noResults: "No results.",
    errorTitle: "Couldn't load this list",
    errorBody: "Check your connection and try again.",
    retry: "Try again",
    loading: "Loading…",
    rowsPerPage: "Rows per page",
    range: "{{from}}–{{to}} of {{total}}",
    page: "Page {{page}} of {{total}}",
    previousPage: "Previous page",
    nextPage: "Next page",
    search: "Search…",
    clearFilters: "Clear filters",
    clearSelection: "Clear selection",
    selected: "{{selected}} of {{total}} selected",
    selectAll: "Select all rows on this page",
    selectRow: "Select row",
  },
  stat: {
    vsPrevious: "vs previous period",
  },
  notFound: {
    title: "Page not found",
    body: "The page you're looking for doesn't exist or was moved.",
    action: "Go home",
  },
  legal: {
    lastUpdated: "Last updated",
    onThisPage: "On this page",
    contact: "Questions? Contact privacy@shiptrack.example.",
    privacy: {
      title: "Privacy Policy",
      intro:
        "This policy explains what personal data ShipTrack collects when you send, track or handle shipments, why we collect it, and the choices you have. ShipTrack is a student project built for the 42 curriculum; no real shipments are processed.",
      sections: [
        {
          id: "data-we-collect",
          title: "Data we collect",
          body: [
            "Account data: your name, email address, password (stored only as a salted hash) and, if you upload one, a profile picture.",
            "Shipment data: pickup and delivery addresses, package weight and declared value, package photos and proof-of-delivery files.",
            "Usage data: sign-in times, online status and the messages you exchange with staff, kept so conversations stay in context.",
          ],
        },
        {
          id: "how-we-use-it",
          title: "How we use it",
          body: [
            "To create and route your shipments, show live tracking, and notify you when a shipment changes status.",
            "To let staff in the assigned branch coordinate deliveries and answer your support messages.",
            "To keep the service secure: detecting abuse, rate-limiting the public API and auditing administrative actions.",
          ],
        },
        {
          id: "sharing",
          title: "Who we share it with",
          body: [
            "Staff of the branch handling your shipment see the data they need to deliver it. Administrators can see account data to manage roles.",
            "Partner systems with an API key can read the status of shipments they created. We never sell personal data.",
          ],
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: [
            "Account data is kept while your account is active. Shipment records are kept for 12 months after delivery, then deleted or anonymised.",
          ],
        },
        {
          id: "your-rights",
          title: "Your rights",
          body: [
            "You can access, correct, export or delete your personal data at any time from your profile, or by contacting us. Deleting your account removes your profile and anonymises your shipment history.",
          ],
        },
        {
          id: "security",
          title: "Security",
          body: [
            "All traffic between your browser and ShipTrack is encrypted with HTTPS. Passwords are hashed and salted, and secrets are never stored in the code repository.",
          ],
        },
        {
          id: "cookies",
          title: "Cookies and local storage",
          body: [
            "We use a session cookie to keep you signed in and local storage to remember your theme and language. We do not use advertising or tracking cookies.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      intro:
        "These terms govern your use of ShipTrack. By creating an account you agree to them. ShipTrack is a student project built for the 42 curriculum and is provided for demonstration purposes.",
      sections: [
        {
          id: "accounts",
          title: "Accounts",
          body: [
            "You must give accurate information and keep your password confidential. You are responsible for activity on your account. Staff accounts are created and assigned to a branch by an administrator.",
          ],
        },
        {
          id: "shipments",
          title: "Shipments",
          body: [
            "You must not ship prohibited, dangerous or illegal goods. Declared values must be honest. Delivery estimates are indicative and may change as a shipment moves through the network.",
          ],
        },
        {
          id: "acceptable-use",
          title: "Acceptable use",
          body: [
            "Do not harass other users or staff, upload malicious files, attempt to access data that isn't yours, or overload the service. The public API is rate-limited; keys used abusively will be revoked.",
          ],
        },
        {
          id: "content",
          title: "Your content",
          body: [
            "You keep ownership of photos, files and messages you upload. You grant ShipTrack the permission needed to store and display them to the people involved in your shipment.",
          ],
        },
        {
          id: "availability",
          title: "Availability and liability",
          body: [
            "The service is provided \"as is\", without guarantees of availability. To the extent allowed by law, ShipTrack is not liable for indirect losses arising from its use.",
          ],
        },
        {
          id: "termination",
          title: "Suspension and termination",
          body: [
            "We may suspend accounts that break these terms. You can close your account at any time from your profile.",
          ],
        },
        {
          id: "changes",
          title: "Changes to these terms",
          body: [
            "We may update these terms. Significant changes will be announced in the app before they take effect; continuing to use ShipTrack means you accept the new version.",
          ],
        },
      ],
    },
  },
};

export default en;

/** Widen string literals so other locales only need matching structure. */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : { [K in keyof T]: Widen<T[K]> };

export type CommonResources = Widen<typeof en>;
