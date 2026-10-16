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
    backToList: "Toutes les expéditions",
    eyebrow: "Expédition",
    copyTrackingId: "Copier le numéro de suivi",
    copyFailed: "Copie impossible. Sélectionnez le numéro de suivi et copiez-le manuellement.",
    notFoundTitle: "Expédition introuvable",
    notFoundBody: "Aucune expédition avec le numéro de suivi {{id}} sur votre compte.",
    detailErrorTitle: "Impossible de charger cette expédition",
    tabs: { timeline: "Historique", details: "Détails", files: "Fichiers" },
    details: { from: "Expéditeur", to: "Destinataire", weight: "Poids", declaredValue: "Valeur déclarée" },
    files: {
      open: "Ouvrir",
      emptyTitle: "Aucun fichier pour l'instant",
      emptyBody: "Les photos du colis et la preuve de livraison apparaîtront ici.",
      errorTitle: "Impossible de charger les fichiers",
      kind: { package_photo: "Photo du colis", proof_of_delivery: "Preuve de livraison", other: "Document" },
    },
    timelineLabel: "Historique de l'expédition",
    timelineEmpty: "Aucune mise à jour pour l'instant",
    timelineErrorTitle: "Impossible de charger l'historique",
  },
};

export default fr;
