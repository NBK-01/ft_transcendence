import type { ClientResources } from "./en";

const fr: ClientResources = {
  pages: {
    shipments: "Suivez en direct chaque colis envoyé.",
    messages: "Échangez avec le support et votre agence à propos d'une expédition.",
    notifications: "Chaque changement de statut et chaque réponse, au même endroit.",
    profile: "Vos informations, votre avatar et vos contacts.",
  },
  shipments: {
    listLabel: "Vos expéditions",
    columns: { trackingId: "N° de suivi", route: "Trajet", status: "Statut", updatedAt: "Dernière mise à jour" },
    emptyTitle: "Aucune expédition pour l'instant",
    emptyBody: "Les expéditions que vous envoyez apparaîtront ici avec leur statut en direct.",
    newShipment: "Nouvelle expédition",
    errorTitle: "Impossible de charger vos expéditions",
    errorBody: "Vérifiez votre connexion et réessayez.",
    retry: "Réessayer",
    searchLabel: "Rechercher par numéro de suivi",
    searchPlaceholder: "N° de suivi, ex. TRK-8F3A21",
    statusLabel: "Filtrer par statut",
    allStatuses: "Tous les statuts",
    noMatchTitle: "Aucune expédition ne correspond",
    noMatchBody: "Essayez un autre numéro de suivi ou un autre statut.",
    clearFilters: "Effacer les filtres",
  },
};

export default fr;
