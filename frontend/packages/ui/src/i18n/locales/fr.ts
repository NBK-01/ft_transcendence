import type { CommonResources } from "./en";

const fr: CommonResources = {
  brand: {
    name: "ShipTrack",
  },
  actions: {
    close: "Fermer",
    cancel: "Annuler",
    delete: "Supprimer",
    save: "Enregistrer",
    copy: "Copier",
    copied: "Copié",
    copyFailed: "Copie impossible. Sélectionnez le texte et copiez-le manuellement.",
  },
  confirmDelete: {
    typeToConfirm: "Saisissez <value>{{value}}</value> pour confirmer",
    error: "Échec de la suppression. Réessayez.",
  },
  status: {
    requested: "Demandée",
    confirmed: "Confirmée",
    in_transit: "En transit",
    out_for_delivery: "En cours de livraison",
    delivered: "Livrée",
    cancelled: "Annulée",
    pending_sourcing: "Recherche fournisseur",
    pending_client_decision: "En attente de décision",
    pending_payment: "Paiement en attente",
    pending_payment_confirmation: "Paiement en vérification",
  },
  timeline: {
    label: "Historique de l'expédition",
  },
  nav: {
    main: "Navigation principale",
    shipments: "Expéditions",
    chat: "Messages",
    contacts: "Contacts",
    notifications: "Notifications",
    profile: "Profil",
    dashboard: "Vue d'ensemble",
    users: "Utilisateurs",
    branches: "Agences",
    apiKeys: "Clés API",
    signOut: "Se déconnecter",
    toggleSidebar: "Afficher ou masquer la barre latérale",
    account: "Compte",
    allBranches: "Toutes les agences",
    branch: "Agence",
    more: "Plus",
    breadcrumb: "Fil d'Ariane",
    skipToContent: "Aller au contenu",
  },
  theme: {
    label: "Thème",
    light: "Clair",
    dark: "Sombre",
    system: "Système",
  },
  language: {
    label: "Langue",
    en: "English",
    fr: "Français",
    ar: "العربية",
  },
  footer: {
    privacy: "Politique de confidentialité",
    terms: "Conditions d'utilisation",
    rights: "© {{year}} ShipTrack. Réalisé dans le cadre du cursus 42.",
    legal: "Mentions légales",
  },
  auth: {
    signInTitle: "Connexion à ShipTrack",
    signInSubtitle: "Suivez vos colis et échangez avec votre agence en temps réel.",
    adminSignInTitle: "Connexion à ShipTrack Admin",
    adminSignInSubtitle: "Réservé au personnel et aux administrateurs.",
    signUpTitle: "Créer votre compte",
    signUpSubtitle: "Expédiez, suivez et soyez notifié à chaque étape.",
    email: "E-mail",
    emailPlaceholder: "vous@exemple.com",
    password: "Mot de passe",
    passwordPlaceholder: "Au moins 8 caractères",
    confirmPassword: "Confirmer le mot de passe",
    firstName: "Prénom",
    lastName: "Nom",
    forgotPassword: "Mot de passe oublié ?",
    signIn: "Se connecter",
    signUp: "Créer le compte",
    noAccount: "Pas encore de compte ?",
    haveAccount: "Vous avez déjà un compte ?",
    acceptTerms:
      "J'accepte les <terms>Conditions d'utilisation</terms> et la <privacy>Politique de confidentialité</privacy>.",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    passwordHint: "8 caractères minimum, avec un chiffre et une lettre.",
    twoFactorTitle: "Authentification à deux facteurs",
    twoFactorSubtitle: "Saisissez le code à 6 chiffres de votre application d'authentification.",
    code: "Code de vérification",
    verify: "Vérifier",
    resend: "Renvoyer le code",
    resendIn: "Renvoyer le code dans {{seconds}} s",
    useBackupCode: "Utiliser un code de secours",
    backToSignIn: "Retour à la connexion",
    mockSignedIn: "Connecté (aperçu — pas encore de backend).",
    mockSignedUp: "Compte créé (aperçu — pas encore de backend).",
    mockVerified: "Code accepté (aperçu — pas encore de backend).",
    mockResent: "Un nouveau code a été envoyé (aperçu).",
    panelTitle: "Chaque étape, visible.",
    panelBody: "Clients, dispatcheurs et livreurs voient la même expédition, mise à jour dès qu'elle bouge.",
    panelLive: "En direct",
    panelTracking: "Suivi",
    panelPlaces: {
      paris: "Paris 11e",
      lyonHub: "Hub de Lyon",
      casablancaHub: "Hub de Casablanca",
      casablanca: "Casablanca, Maârif",
    },
    or: "ou",
  },
  validation: {
    required: "Ce champ est obligatoire.",
    email: "Saisissez une adresse e-mail valide.",
    passwordMin: "Utilisez au moins 8 caractères.",
    passwordStrength: "Incluez au moins une lettre et un chiffre.",
    passwordMatch: "Les mots de passe ne correspondent pas.",
    passwordSame: "Choisissez un mot de passe différent de l'actuel.",
    nameMax: "50 caractères maximum.",
    descriptionMax: "200 caractères maximum.",
    dateOfBirth: "Saisissez une date réelle dans le passé.",
    phone: "Saisissez un numéro avec l'indicatif du pays, ex. +33 6 12 34 56 78.",
    otp: "Saisissez les 6 chiffres.",
    terms: "Vous devez accepter les conditions pour continuer.",
  },
  empty: {
    comingSoonTitle: "Rien pour l'instant",
    comingSoonBody:
      "Cette section fait partie de la prochaine étape. La mise en page est prête ; les données arriveront avec l'API.",
    backHome: "Retour à la vue d'ensemble",
  },
  table: {
    noResults: "Aucun résultat.",
    errorTitle: "Impossible de charger cette liste",
    errorBody: "Vérifiez votre connexion et réessayez.",
    forbiddenTitle: "Vous n'avez pas accès à cette liste",
    forbiddenBody: "Votre rôle ne l'inclut pas. Demandez à un administrateur si vous en avez besoin.",
    retry: "Réessayer",
    loading: "Chargement…",
    rowsPerPage: "Lignes par page",
    range: "{{from}}–{{to}} sur {{total}}",
    page: "Page {{page}} sur {{total}}",
    previousPage: "Page précédente",
    nextPage: "Page suivante",
    search: "Rechercher…",
    clearFilters: "Effacer les filtres",
    selected: "{{selected}} sur {{total}} sélectionné(s)",
    selectAll: "Sélectionner toutes les lignes de la page",
    selectRow: "Sélectionner la ligne",
  },
  stat: {
    vsPrevious: "par rapport à la période précédente",
    error: "Chargement impossible",
  },
  notFound: {
    title: "Page introuvable",
    body: "La page que vous cherchez n'existe pas ou a été déplacée.",
    action: "Retour à l'accueil",
  },
  legal: {
    lastUpdated: "Dernière mise à jour",
    onThisPage: "Sur cette page",
    contact: "Des questions ? Écrivez à privacy@shiptrack.example.",
    privacy: {
      title: "Politique de confidentialité",
      intro:
        "Cette politique explique quelles données personnelles ShipTrack collecte lorsque vous envoyez, suivez ou traitez des expéditions, pourquoi nous les collectons et quels sont vos choix. ShipTrack est un projet étudiant réalisé pour le cursus 42 ; aucune expédition réelle n'est traitée.",
      sections: [
        {
          id: "data-we-collect",
          title: "Données collectées",
          body: [
            "Données de compte : votre nom, votre adresse e-mail, votre mot de passe (stocké uniquement sous forme de hachage salé) et, si vous en ajoutez une, une photo de profil.",
            "Données d'expédition : adresses d'enlèvement et de livraison, poids et valeur déclarée du colis, photos du colis et preuves de livraison.",
            "Données d'utilisation : heures de connexion, statut en ligne et messages échangés avec le personnel, conservés pour garder le contexte des conversations.",
          ],
        },
        {
          id: "how-we-use-it",
          title: "Utilisation des données",
          body: [
            "Créer et acheminer vos expéditions, afficher le suivi en direct et vous prévenir à chaque changement de statut.",
            "Permettre au personnel de l'agence concernée de coordonner les livraisons et de répondre à vos messages.",
            "Sécuriser le service : détection des abus, limitation du débit de l'API publique et journalisation des actions d'administration.",
          ],
        },
        {
          id: "sharing",
          title: "Partage des données",
          body: [
            "Le personnel de l'agence qui gère votre expédition voit les données nécessaires à la livraison. Les administrateurs peuvent consulter les données de compte pour gérer les rôles.",
            "Les systèmes partenaires disposant d'une clé API peuvent consulter le statut des expéditions qu'ils ont créées. Nous ne vendons jamais de données personnelles.",
          ],
        },
        {
          id: "retention",
          title: "Durée de conservation",
          body: [
            "Les données de compte sont conservées tant que votre compte est actif. Les expéditions sont conservées 12 mois après la livraison, puis supprimées ou anonymisées.",
          ],
        },
        {
          id: "your-rights",
          title: "Vos droits",
          body: [
            "Vous pouvez à tout moment consulter, corriger, exporter ou supprimer vos données depuis votre profil ou en nous contactant. La suppression du compte efface votre profil et anonymise votre historique d'expéditions.",
          ],
        },
        {
          id: "security",
          title: "Sécurité",
          body: [
            "Tout le trafic entre votre navigateur et ShipTrack est chiffré en HTTPS. Les mots de passe sont hachés et salés, et aucun secret n'est stocké dans le dépôt de code.",
          ],
        },
        {
          id: "cookies",
          title: "Cookies et stockage local",
          body: [
            "Nous utilisons un cookie de session pour vous garder connecté et le stockage local pour mémoriser votre thème et votre langue. Nous n'utilisons aucun cookie publicitaire ni de suivi.",
          ],
        },
      ],
    },
    terms: {
      title: "Conditions d'utilisation",
      intro:
        "Ces conditions régissent l'utilisation de ShipTrack. En créant un compte, vous les acceptez. ShipTrack est un projet étudiant réalisé pour le cursus 42 et fourni à titre de démonstration.",
      sections: [
        {
          id: "accounts",
          title: "Comptes",
          body: [
            "Vous devez fournir des informations exactes et garder votre mot de passe confidentiel. Vous êtes responsable de l'activité de votre compte. Les comptes du personnel sont créés et rattachés à une agence par un administrateur.",
          ],
        },
        {
          id: "shipments",
          title: "Expéditions",
          body: [
            "Il est interdit d'expédier des marchandises prohibées, dangereuses ou illégales. Les valeurs déclarées doivent être sincères. Les délais de livraison sont indicatifs et peuvent évoluer.",
          ],
        },
        {
          id: "acceptable-use",
          title: "Usage acceptable",
          body: [
            "Ne harcelez pas les autres utilisateurs ou le personnel, n'envoyez pas de fichiers malveillants, n'essayez pas d'accéder à des données qui ne vous appartiennent pas et ne surchargez pas le service. L'API publique est limitée en débit ; les clés utilisées de manière abusive seront révoquées.",
          ],
        },
        {
          id: "content",
          title: "Vos contenus",
          body: [
            "Vous restez propriétaire des photos, fichiers et messages que vous envoyez. Vous accordez à ShipTrack l'autorisation nécessaire pour les stocker et les afficher aux personnes concernées par votre expédition.",
          ],
        },
        {
          id: "availability",
          title: "Disponibilité et responsabilité",
          body: [
            "Le service est fourni « en l'état », sans garantie de disponibilité. Dans la limite permise par la loi, ShipTrack n'est pas responsable des pertes indirectes liées à son utilisation.",
          ],
        },
        {
          id: "termination",
          title: "Suspension et résiliation",
          body: [
            "Nous pouvons suspendre les comptes qui enfreignent ces conditions. Vous pouvez fermer votre compte à tout moment depuis votre profil.",
          ],
        },
        {
          id: "changes",
          title: "Modification des conditions",
          body: [
            "Ces conditions peuvent évoluer. Les changements importants seront annoncés dans l'application avant leur entrée en vigueur ; continuer à utiliser ShipTrack vaut acceptation de la nouvelle version.",
          ],
        },
      ],
    },
  },
};

export default fr;
