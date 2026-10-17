import type { AdminResources } from "./en";

const fr: AdminResources = {
  logoLabel: "Admin",
  groups: {
    operations: "Opérations",
    manage: "Gestion",
  },
  pages: {
    dashboard: "Vue en direct des expéditions, agences et équipes.",
    shipments: "Toutes les expéditions des agences auxquelles vous avez accès.",
    messages: "Conversations entre le personnel et les clients.",
    users: "Comptes du personnel : rôles, agences et accès.",
    branches: "Les agences sont des organisations : membres, adresse et expéditions.",
    apiKeys: "Clés permettant aux systèmes partenaires d'utiliser l'API publique.",
    profile: "Les informations de votre compte.",
  },
  users: {
    columns: { name: "Nom", role: "Rôle", branch: "Agence", status: "Statut", created: "Créé le" },
    roles: { admin: "Admin", dispatcher: "Dispatcheur", driver: "Chauffeur", support: "Support", none: "Aucun rôle" },
    status: { active: "Actif", deactivated: "Désactivé" },
    noBranch: "Aucune agence",
    search: "Rechercher un nom ou un e-mail…",
    emptyTitle: "Aucun compte pour l'instant",
    emptyBody: "Les comptes du personnel que vous créez apparaîtront ici.",
  },
};

export default fr;
