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
    errorTitle: "Impossible de charger vos expéditions",
    errorBody: "Vérifiez votre connexion et réessayez.",
    retry: "Réessayer",
  },
};

export default fr;
