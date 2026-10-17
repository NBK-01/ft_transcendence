import type { ClientResources } from "./en";

const fr: ClientResources = {
  profile: {
    edit: "Modifier le profil",
    saved: "Profil enregistré",
    retry: "Réessayer",
    notSet: "Non renseigné",
    verified: "E-mail vérifié",
    addPhoto: "Ajouter une photo",
    changePhoto: "Changer la photo",
    uploading: "Envoi… {{percent}} %",
    avatarUpdated: "Photo mise à jour",
    photoHint: "JPG, PNG ou WebP, 2 Mo max.",
    emailHint: "Votre e-mail de connexion ne peut pas être modifié ici.",
    phoneHint: "Avec l'indicatif du pays, ex. +33 6 12 34 56 78.",
    fields: {
      firstName: "Prénom",
      lastName: "Nom",
      email: "E-mail",
      dateOfBirth: "Date de naissance",
      phoneNumber: "Téléphone",
    },
    errors: {
      loadTitle: "Impossible de charger votre profil",
      loadBody: "Vérifiez votre connexion et réessayez.",
      save: "Impossible d'enregistrer votre profil. Réessayez.",
      avatarType: "Choisissez une image JPG, PNG ou WebP.",
      avatarSize: "La photo doit faire 2 Mo maximum.",
      avatarUpload: "Impossible d'envoyer la photo. Réessayez.",
      dateOfBirth: "Saisissez une date réelle dans le passé.",
      phone: "Saisissez un numéro avec l'indicatif du pays, ex. +33 6 12 34 56 78.",
    },
  },
  pages: {
    shipments: "Suivez en direct chaque colis envoyé.",
    messages: "Échangez avec le support et votre agence à propos d'une expédition.",
    notifications: "Chaque changement de statut et chaque réponse, au même endroit.",
    profile: "Votre photo et vos informations personnelles.",
  },
};

export default fr;
