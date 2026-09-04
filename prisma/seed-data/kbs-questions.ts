/**
 * KBS question bank — real content, not filler.
 *
 * Two properties matter beyond the text itself:
 *
 * 1. The correct answer is NOT always in the same position. An earlier draft had
 *    `isCorrect: index === 0` throughout, which meant a candidate picking the
 *    first option always certified, and a grading bug that always marked the
 *    first option correct would have been undetectable by any test written
 *    against this data. `correct` is an explicit index per question.
 * 2. Distractors are plausible rather than obviously wrong, so a tester
 *    reviewing the platform is judging KBS, not judging filler.
 */

export type SeedQuestion = {
  /** Question text, French. */
  q: string;
  /** Four answers, in a fixed order. */
  a: [string, string, string, string];
  /** Index (0-3) of the correct answer. Deliberately varied. */
  correct: 0 | 1 | 2 | 3;
};

/** Module 1 — Présentation de KAMBRIQ et de son offre. */
export const MODULE_1_QUIZ: SeedQuestion[] = [
  {
    q: 'Quelle est la vocation première de KAMBRIQ sur le marché camerounais ?',
    a: [
      'Sécuriser et commercialiser des parcelles au titre foncier vérifié',
      "Construire des logements sociaux pour le compte de l'État",
      'Accorder des prêts immobiliers aux particuliers',
      'Gérer la location de biens résidentiels',
    ],
    correct: 0,
  },
  {
    q: 'Que garantit un titre foncier (TF) par rapport à une simple attestation de vente ?',
    a: [
      'Un prix de revente supérieur',
      'Un droit de propriété définitif et opposable aux tiers',
      'Une exonération de taxe foncière',
      'Un accès prioritaire au crédit bancaire',
    ],
    correct: 1,
  },
  {
    q: 'Que signifie le label KAMBRIQ TFL\u2122 ?',
    a: [
      'Terrain Foncier Libre',
      'Titre Foncier Loti',
      'Terrain en Financement Locatif',
      'Transfert Foncier Légalisé',
    ],
    correct: 1,
  },
  {
    q: 'Que signifie le label KAMBRIQ VEFIL\u2122 ?',
    a: [
      "Vente en État Futur d'Immatriculation et de Lotissement",
      "Vente en État Futur d'Investissement Locatif",
      'Vérification Foncière et Immatriculation Légale',
      'Valeur Estimée du Foncier Individuel Loti',
    ],
    correct: 0,
  },
  {
    q: 'Pourquoi KAMBRIQ vérifie-t-elle chaque parcelle avant mise en vente ?',
    a: [
      'Pour fixer un prix plus élevé',
      'Pour écarter les litiges et les doubles ventes',
      'Pour obtenir une réduction de taxes',
      'Parce que la loi impose une revente sous six mois',
    ],
    correct: 1,
  },
  {
    q: "À qui s'adresse en priorité l'offre KAMBRIQ ?",
    a: [
      'Exclusivement aux promoteurs institutionnels',
      'Uniquement aux résidents de Douala',
      'Aux particuliers et à la diaspora cherchant un foncier sécurisé',
      'Aux seules entreprises du BTP',
    ],
    correct: 2,
  },
  {
    q: 'Quel risque le client évite-t-il en achetant une parcelle vérifiée ?',
    a: [
      'La hausse des prix du ciment',
      "L'acquisition d'un terrain déjà vendu ou litigieux",
      'Les frais de notaire',
      'Le délai de construction',
    ],
    correct: 1,
  },
  {
    q: "Que contient le dossier remis au client à l'issue d'une acquisition ?",
    a: [
      'Les pièces justifiant la propriété et la transaction',
      'Un plan de financement bancaire',
      'Un permis de construire pré-approuvé',
      'Une assurance habitation',
    ],
    correct: 0,
  },
  {
    q: "Quelle est la conséquence d'une parcelle sans bornage clair ?",
    a: [
      'Une réduction automatique du prix',
      'Un risque de conflit de limites avec les voisins',
      "Une exonération de droits d'enregistrement",
      'Une vente plus rapide',
    ],
    correct: 1,
  },
  {
    q: 'Le positionnement de KAMBRIQ repose avant tout sur :',
    a: [
      'Le prix le plus bas du marché',
      'La rapidité de livraison des constructions',
      'La traçabilité et la sécurité juridique du foncier',
      "L'exclusivité géographique sur une seule ville",
    ],
    correct: 2,
  },
  {
    q: 'Que doit vérifier un agent avant de présenter une parcelle à un client ?',
    a: [
      'Sa disponibilité et son statut au catalogue',
      'La météo de la région',
      'Le nombre de vues sur le site',
      'La date de création de la fiche',
    ],
    correct: 0,
  },
  {
    q: "Qu'est-ce qu'un lotissement au sens de l'offre KAMBRIQ ?",
    a: [
      'Un immeuble divisé en appartements',
      "Une division d'un terrain en parcelles viabilisées",
      'Un regroupement de propriétaires',
      'Un mode de financement collectif',
    ],
    correct: 1,
  },
  {
    q: 'Pourquoi la diaspora représente-t-elle un segment clé ?',
    a: [
      "Elle bénéficie d'une fiscalité réduite",
      'Elle achète uniquement en zone rurale',
      "Elle investit à distance et a besoin d'une garantie de sécurité juridique",
      'Elle est exemptée de bornage',
    ],
    correct: 2,
  },
  {
    q: 'Que signifie « parcelle viabilisée » ?',
    a: [
      'Elle est raccordable aux réseaux essentiels',
      'Elle est déjà construite',
      'Elle est vendue sans titre',
      'Elle est réservée à la location',
    ],
    correct: 0,
  },
  {
    q: 'Que signifie le label KAMBRIQ VEFL\u2122 ?',
    a: [
      'Vente en État Futur de Lotissement',
      'Vente en État Futur de Livraison',
      'Vérification et Expertise Foncière Locale',
      'Valeur Estimée du Foncier Loti',
    ],
    correct: 0,
  },
  {
    q: 'Quel document atteste que la vérification KAMBRIQ a été effectuée ?',
    a: [
      'Le devis de construction',
      'La quittance de loyer',
      'La référence de vérification associée à la parcelle',
      "Le contrat d'agence",
    ],
    correct: 2,
  },
  {
    q: 'Un client demande si sa parcelle peut être revendue. Que répondez-vous ?',
    a: [
      'Oui, la propriété transférée est cessible',
      'Non, la revente est interdite',
      'Seulement après dix ans',
      'Uniquement à un autre client KAMBRIQ',
    ],
    correct: 0,
  },
  {
    q: 'Que se passe-t-il si une réservation est annulée ?',
    a: [
      'La parcelle est archivée définitivement',
      'La parcelle redevient disponible au catalogue',
      'Le client est inscrit sur liste noire',
      'Le dossier reste bloqué un an',
    ],
    correct: 1,
  },
  {
    q: "Quel est l'intérêt d'un historique de prix sur une parcelle ?",
    a: [
      'Il accélère la construction',
      'Il remplace le titre foncier',
      "Il donne de la transparence sur l'évolution de la valeur",
      "Il fixe le montant de l'acompte",
    ],
    correct: 2,
  },
  {
    q: 'Quelle information ne doit jamais être communiquée à un tiers ?',
    a: [
      "Les pièces d'identité du client",
      'La superficie de la parcelle',
      'Le prix affiché',
      'La région du bien',
    ],
    correct: 0,
  },
  {
    q: "La superficie d'une parcelle est exprimée en :",
    a: ['Hectares uniquement', 'Mètres carrés', 'Ares uniquement', 'Pieds carrés'],
    correct: 1,
  },
  {
    q: "Que doit faire l'agent si un client conteste une limite de terrain ?",
    a: [
      'Modifier lui-même le plan',
      'Proposer une remise commerciale',
      "Remonter le cas à l'administration foncière via KAMBRIQ",
      'Annuler la vente sans instruction',
    ],
    correct: 2,
  },
  {
    q: 'Le statut « Vendue » signifie que la parcelle :',
    a: [
      "N'est plus commercialisable",
      'Peut encore être réservée',
      'Est en cours de vérification',
      'Est en attente de publication',
    ],
    correct: 0,
  },
  {
    q: 'Pourquoi publier des photos et documents sur une fiche parcelle ?',
    a: [
      'Pour améliorer le référencement fiscal',
      "Pour permettre au client d'évaluer le bien à distance",
      'Pour remplacer la visite obligatoire',
      'Pour augmenter automatiquement le prix',
    ],
    correct: 1,
  },
  {
    q: "Qu'est-ce que le PV dans la fiche d'une parcelle ?",
    a: [
      'Le prix de vente net',
      'Le procès-verbal de bornage',
      'Le coefficient de valorisation utilisé pour les commissions',
      'La période de validité',
    ],
    correct: 2,
  },
  {
    q: 'Une parcelle non publiée est :',
    a: [
      'Invisible au catalogue public',
      'Automatiquement réservée',
      'Vendue en priorité',
      'Exemptée de vérification',
    ],
    correct: 0,
  },
  {
    q: "Quel interlocuteur valide le passage d'une réservation à une vente ?",
    a: [
      'Le client lui-même',
      "L'administration KAMBRIQ",
      "N'importe quel agent",
      'Le voisin de la parcelle',
    ],
    correct: 1,
  },
  {
    q: 'Que signifie « opposable aux tiers » pour un titre foncier ?',
    a: [
      'Il peut être contesté à tout moment',
      "Il n'a de valeur qu'entre les parties",
      "Il s'impose à toute autre personne revendiquant le bien",
      'Il expire au bout de cinq ans',
    ],
    correct: 2,
  },
  {
    q: "Le rôle d'un agent KAMBRIQ face à une demande hors catalogue est de :",
    a: [
      'Remonter le besoin plutôt que promettre un bien inexistant',
      'Promettre une parcelle équivalente',
      'Refuser le client',
      "Vendre un bien d'un concurrent",
    ],
    correct: 0,
  },
  {
    q: 'Quelle est la finalité du dossier client complet ?',
    a: [
      'Accélérer la publicité',
      'Sécuriser juridiquement la transaction pour les deux parties',
      "Réduire le prix d'achat",
      'Remplacer le titre foncier',
    ],
    correct: 1,
  },
];

/** Module 2 — Techniques de vente immobilière. */
export const MODULE_2_QUIZ: SeedQuestion[] = [
  {
    q: "Quelle est la première étape d'une prospection efficace ?",
    a: [
      'Qualifier le besoin et la capacité du prospect',
      'Envoyer le catalogue complet',
      'Proposer une remise immédiate',
      'Fixer un rendez-vous notaire',
    ],
    correct: 0,
  },
  {
    q: "Qu'est-ce qu'un prospect qualifié ?",
    a: [
      'Un contact ayant visité le site',
      "Un contact dont le besoin, le budget et l'échéance sont connus",
      'Un contact ayant un numéro valide',
      'Un contact recommandé par un agent',
    ],
    correct: 1,
  },
  {
    q: "Face à l'objection « c'est trop cher », la meilleure réaction est de :",
    a: [
      'Baisser le prix aussitôt',
      'Changer de parcelle',
      'Reformuler pour comprendre ce qui est comparé',
      "Mettre fin à l'échange",
    ],
    correct: 2,
  },
  {
    q: "Un argumentaire de vente efficace s'appuie d'abord sur :",
    a: [
      'Les bénéfices concrets pour ce client précis',
      'La liste exhaustive des caractéristiques',
      'Le prix le plus bas disponible',
      "L'ancienneté de l'agence",
    ],
    correct: 0,
  },
  {
    q: "Que faire lorsqu'un client demande une garantie que vous ne pouvez pas donner ?",
    a: [
      'La promettre pour conclure',
      "Dire clairement ce qui est garanti et ce qui ne l'est pas",
      'Ignorer la question',
      'Renvoyer vers un concurrent',
    ],
    correct: 1,
  },
  {
    q: 'Le closing intervient normalement :',
    a: [
      'Dès le premier contact',
      'Avant la qualification',
      'Lorsque les objections principales sont levées',
      'Uniquement par écrit après six mois',
    ],
    correct: 2,
  },
  {
    q: "Quel est l'intérêt d'un suivi client après la vente ?",
    a: [
      'Générer des recommandations et fidéliser',
      'Justifier une commission supplémentaire',
      'Retarder la remise des documents',
      'Éviter le bornage',
    ],
    correct: 0,
  },
  {
    q: 'Une objection exprimée par le client est avant tout :',
    a: [
      'Un refus définitif',
      "Un signal d'intérêt à traiter",
      'Une perte de temps',
      'Une demande de remise',
    ],
    correct: 1,
  },
  {
    q: 'Que consigner après chaque échange avec un prospect ?',
    a: [
      'Rien, pour rester agile',
      'Uniquement le prix discuté',
      "Le besoin, l'étape atteinte et la prochaine action",
      'Seulement son numéro',
    ],
    correct: 2,
  },
  {
    q: "Quelle attitude adopter si le prospect n'est pas décideur ?",
    a: [
      "Identifier le décideur et l'associer à la démarche",
      'Conclure quand même',
      'Abandonner le dossier',
      'Augmenter le prix',
    ],
    correct: 0,
  },
  {
    q: 'Un lead au statut « converti » signifie :',
    a: [
      'Il a été contacté',
      'Il a abouti à une réservation ou une vente',
      'Il a été supprimé',
      "Il a changé d'agent",
    ],
    correct: 1,
  },
  {
    q: "La relance d'un prospect silencieux doit être :",
    a: [
      'Quotidienne et insistante',
      'Abandonnée après un essai',
      "Espacée, utile et porteuse d'un élément nouveau",
      'Confiée à un autre agent',
    ],
    correct: 2,
  },
  {
    q: 'Comment traiter une demande de délai de paiement ?',
    a: [
      'Expliquer les modalités officielles sans improviser',
      'Accorder un délai oral',
      'Refuser toute discussion',
      'Réduire la superficie vendue',
    ],
    correct: 0,
  },
  {
    q: "Quel est le risque d'un argumentaire uniquement centré sur le prix ?",
    a: [
      'Il allonge le délai de vente',
      'Il rend la valeur du bien invisible et fragilise la marge',
      'Il empêche le bornage',
      'Il annule la vérification',
    ],
    correct: 1,
  },
  {
    q: "Que faire si un client fournit un document d'identité illisible ?",
    a: [
      "L'accepter pour ne pas le froisser",
      'Le compléter soi-même',
      'Demander une pièce lisible avant de poursuivre',
      'Poursuivre sans document',
    ],
    correct: 2,
  },
  {
    q: 'La prise de rendez-vous physique sert principalement à :',
    a: [
      'Lever les doutes que le distanciel ne lève pas',
      'Remplacer le dossier client',
      'Éviter la vérification foncière',
      'Réduire la commission',
    ],
    correct: 0,
  },
  {
    q: "Un prospect issu d'une recommandation se distingue par :",
    a: [
      'Un prix négocié plus bas',
      'Un niveau de confiance initial plus élevé',
      'Une exemption de dossier',
      'Un délai de rétractation plus long',
    ],
    correct: 1,
  },
  {
    q: 'Comment répondre à « je vais réfléchir » ?',
    a: [
      'Conclure la discussion',
      'Relancer le lendemain sans contexte',
      'Identifier le point précis qui bloque encore',
      'Proposer immédiatement une autre parcelle',
    ],
    correct: 2,
  },
  {
    q: "Le rôle de l'agent lors de la constitution du dossier est de :",
    a: [
      'Vérifier la complétude des pièces demandées',
      'Rédiger le titre foncier',
      'Fixer le prix de vente',
      'Valider seul la transaction',
    ],
    correct: 0,
  },
  {
    q: "Une commission d'agent est calculée à partir :",
    a: [
      'Du nombre de visites',
      'Des paramètres de la vente enregistrée',
      "De l'ancienneté de l'agent",
      'Du nombre de leads créés',
    ],
    correct: 1,
  },
  {
    q: "Quel comportement expose l'agent et KAMBRIQ à un risque juridique ?",
    a: [
      'Documenter chaque étape',
      "Orienter vers l'administration",
      'Promettre un délai ou une garantie hors procédure',
      'Refuser une remise',
    ],
    correct: 2,
  },
  {
    q: 'Pourquoi qualifier le budget dès le premier échange ?',
    a: [
      'Pour orienter vers des parcelles réellement accessibles',
      'Pour majorer le prix',
      'Pour écarter les clients modestes',
      'Pour calculer la commission',
    ],
    correct: 0,
  },
  {
    q: 'Un dossier client incomplet a pour conséquence :',
    a: [
      'Une commission plus faible',
      "Un blocage de l'avancement de la réservation",
      'Une annulation automatique',
      'Une hausse du prix',
    ],
    correct: 1,
  },
  {
    q: 'La meilleure façon de présenter une parcelle à distance est :',
    a: [
      'Un message vocal',
      'Une description orale seule',
      "Des médias et documents accompagnés d'un échange",
      'Un simple lien sans contexte',
    ],
    correct: 2,
  },
  {
    q: "Face à deux clients intéressés par la même parcelle, l'agent doit :",
    a: [
      "Appliquer l'ordre de réservation enregistré",
      'Choisir le plus offrant sans trace',
      'Réserver pour les deux',
      'Retirer la parcelle',
    ],
    correct: 0,
  },
  {
    q: 'Le suivi post-vente inclut notamment :',
    a: [
      'La renégociation du prix',
      'La remise des documents et la disponibilité pour les questions',
      'La reprise du bien',
      'La révision du bornage',
    ],
    correct: 1,
  },
  {
    q: 'Un agent suspendu ne peut plus :',
    a: [
      'Consulter le catalogue public',
      'Recevoir des recommandations',
      'Enregistrer de nouvelles réservations',
      'Être contacté par un client',
    ],
    correct: 2,
  },
  {
    q: "Le niveau (tier) d'un agent progresse en fonction :",
    a: [
      'De son volume de ventes enregistré',
      'De son ancienneté seule',
      'Du nombre de leads créés',
      "De sa région d'exercice",
    ],
    correct: 0,
  },
  {
    q: "Que faire d'un lead qui n'est plus joignable ?",
    a: [
      'Le supprimer définitivement sans trace',
      'Mettre à jour son statut pour refléter la réalité',
      'Le transférer à un concurrent',
      'Le marquer converti',
    ],
    correct: 1,
  },
  {
    q: 'La transparence sur ce que KAMBRIQ ne garantit pas sert à :',
    a: [
      'Réduire la commission',
      'Allonger le cycle de vente',
      "Protéger le client et l'agent en cas de litige",
      'Éviter le dossier client',
    ],
    correct: 2,
  },
];

/** Module 1 — banque d'examen. Questions distinctes du quiz, à visée certifiante. */
export const MODULE_1_EXAM: SeedQuestion[] = [
  {
    q: 'Un client présente une attestation de vente signée par un chef de village. Quelle est sa valeur juridique face à un titre foncier ?',
    a: [
      'Équivalente si elle est enregistrée',
      'Supérieure en zone rurale',
      'Elle ne confère pas la propriété opposable aux tiers',
      'Elle vaut titre après trois ans',
    ],
    correct: 2,
  },
  {
    q: "Une parcelle porte le statut RESERVED depuis huit mois sans avancement du dossier. Quelle est l'action correcte ?",
    a: [
      'La vendre à un autre client immédiatement',
      "Instruire l'annulation pour la remettre au catalogue",
      'La passer en ARCHIVED sans instruction',
      "La laisser en l'état indéfiniment",
    ],
    correct: 1,
  },
  {
    q: 'Deux clients revendiquent la même parcelle avec des dates de réservation différentes. Sur quoi trancher ?',
    a: [
      "L'ordre de réservation enregistré",
      'Le montant proposé',
      "L'ancienneté du client",
      'La proximité géographique',
    ],
    correct: 0,
  },
  {
    q: 'Un acheteur de la diaspora ne peut pas se déplacer pour la signature. Que permet une acquisition sécurisée ?',
    a: [
      'Une vente sans dossier',
      'Un transfert de propriété oral',
      'Une renonciation au titre foncier',
      'Une représentation dûment mandatée avec dossier complet',
    ],
    correct: 3,
  },
  {
    q: 'La superficie annoncée diffère de celle du titre foncier. Quelle est la référence ?',
    a: [
      'La superficie du titre foncier',
      'La superficie annoncée au catalogue',
      'La moyenne des deux',
      'La mesure faite par le client',
    ],
    correct: 0,
  },
  {
    q: "Sur un terrain KAMBRIQ VEFL\u2122, où en est le titre foncier au moment de l'achat ?",
    a: [
      "Il n'existe pas encore",
      "Il existe déjà, l'immatriculation est faite et le lotissement est en cours",
      "Il est en cours d'immatriculation",
      'Il est délivré après la construction',
    ],
    correct: 1,
  },
  {
    q: "Un document client a été rejeté par l'administration. Quelle suite donner ?",
    a: [
      'Annuler la réservation',
      'Réutiliser le document tel quel',
      'Notifier le motif au client et demander une pièce conforme',
      'Poursuivre sans le document',
    ],
    correct: 2,
  },
  {
    q: "Pourquoi l'historique de prix d'une parcelle est-il conservé ?",
    a: [
      'Pour calculer la TVA',
      'Pour fixer la commission',
      'Pour permettre la revente',
      'Pour tracer les décisions et justifier la valeur',
    ],
    correct: 3,
  },
  {
    q: "Un agent constate qu'une parcelle publiée est en réalité déjà vendue. Sa première action est de :",
    a: [
      'Signaler immédiatement pour retirer la parcelle',
      'Vendre la parcelle voisine à la place',
      'Ne rien faire, le système corrigera',
      'Baisser le prix',
    ],
    correct: 0,
  },
  {
    q: "Quelle est la conséquence d'une double vente non détectée ?",
    a: [
      'Une simple correction comptable',
      'Un litige de propriété engageant la responsabilité de KAMBRIQ',
      'Une perte de commission seulement',
      'Un report de livraison',
    ],
    correct: 1,
  },
  {
    q: 'Le bornage contradictoire sert à :',
    a: [
      'Fixer le prix au mètre carré',
      'Obtenir un permis de construire',
      'Établir les limites en présence des riverains',
      'Enregistrer la vente',
    ],
    correct: 2,
  },
  {
    q: 'Une parcelle marquée « non vérifiée » peut-elle être proposée à un client ?',
    a: [
      'Oui avec une remise',
      'Oui si le client accepte le risque',
      'Oui en zone rurale',
      'Non, la vérification précède la commercialisation',
    ],
    correct: 3,
  },
  {
    q: "Que doit contenir au minimum le dossier d'une réservation confirmée ?",
    a: [
      "Les pièces d'identité et les justificatifs demandés",
      'Une photo de la parcelle',
      'Un devis de construction',
      "Une attestation d'assurance",
    ],
    correct: 0,
  },
  {
    q: 'Un client demande de modifier la superficie après signature. Que faire ?',
    a: [
      'Modifier la fiche discrètement',
      'Refuser toute modification post-signature hors procédure officielle',
      'Accorder une compensation financière',
      'Annuler et revendre',
    ],
    correct: 1,
  },
  {
    q: "Le statut COMPLETED d'une réservation signifie que :",
    a: [
      "Le client a payé l'acompte",
      'Le dossier est en cours',
      "Le parcours d'acquisition est arrivé à son terme",
      'La parcelle est réservée',
    ],
    correct: 2,
  },
  {
    q: 'Quelle est la bonne réponse à « puis-je construire immédiatement ? »',
    a: [
      'Oui dans tous les cas',
      'Non jamais',
      "Oui après paiement de l'acompte",
      "Cela dépend des autorisations d'urbanisme applicables",
    ],
    correct: 3,
  },
  {
    q: "Un titre foncier au nom d'un tiers est présenté pour une vente. L'agent doit :",
    a: [
      'Exiger la preuve du pouvoir de vendre',
      'Accepter si le prix est correct',
      'Demander une remise',
      'Passer par un intermédiaire',
    ],
    correct: 0,
  },
  {
    q: 'La mention isPublished à false sur une parcelle signifie :',
    a: [
      'Elle est vendue',
      "Elle n'apparaît pas au catalogue public",
      'Elle est litigieuse',
      'Elle est réservée',
    ],
    correct: 1,
  },
  {
    q: "Pourquoi les documents privés d'une parcelle ne sont-ils pas publics ?",
    a: [
      'Pour réduire le stockage',
      "Pour accélérer l'affichage",
      "Parce qu'ils contiennent des données sensibles",
      "Parce qu'ils sont provisoires",
    ],
    correct: 2,
  },
  {
    q: 'Un client souhaite annuler après confirmation du versement. Quelle est la démarche ?',
    a: [
      'Suppression de la réservation',
      'Remboursement automatique immédiat',
      'Transfert à un autre client',
      'Enregistrer une annulation motivée selon la procédure',
    ],
    correct: 3,
  },
  {
    q: "Une parcelle est vendue mais son statut n'a pas été mis à jour. Quel est le premier risque ?",
    a: [
      'Une perte de référencement',
      'Une double réservation par un autre agent',
      'Une erreur de commission',
      'Un retard de bornage',
    ],
    correct: 1,
  },
  {
    q: 'Le client demande à visiter avant de réserver. Quelle est la bonne pratique ?',
    a: [
      'Organiser la visite avant tout engagement financier',
      "Exiger l'acompte d'abord",
      'Refuser les visites',
      'Envoyer uniquement des photos',
    ],
    correct: 0,
  },
  {
    q: 'Quelle pièce établit formellement le transfert de propriété ?',
    a: [
      'Le reçu de versement',
      'La fiche parcelle',
      'Le titre foncier mis à jour',
      "Le contrat d'agence",
    ],
    correct: 2,
  },
  {
    q: "Un terrain figure dans deux dossiers différents avec deux superficies. L'agent doit :",
    a: [
      'Retenir la plus grande',
      'Retenir la plus petite',
      'Faire la moyenne',
      'Suspendre et faire trancher sur pièces',
    ],
    correct: 3,
  },
  {
    q: 'Pourquoi archiver une parcelle plutôt que la supprimer ?',
    a: [
      "Pour conserver l'historique et la traçabilité",
      'Pour réduire les coûts',
      'Pour accélérer les requêtes',
      'Pour la revendre plus vite',
    ],
    correct: 0,
  },
  {
    q: "Un client veut acheter au nom d'une société. Que faut-il vérifier ?",
    a: [
      "Le chiffre d'affaires",
      'Le pouvoir du signataire à engager la société',
      "Le nombre d'employés",
      "L'ancienneté de la société",
    ],
    correct: 1,
  },
  {
    q: 'La mention « vérifiée » sur une parcelle engage :',
    a: [
      'Le client seul',
      "L'agent seul",
      'KAMBRIQ sur la qualité du contrôle effectué',
      'Personne',
    ],
    correct: 2,
  },
  {
    q: 'Un acompte est versé mais le dossier révèle un litige. Que faire ?',
    a: [
      'Poursuivre la vente',
      'Proposer une autre parcelle sans trace',
      "Conserver l'acompte",
      'Suspendre et traiter le litige avant toute suite',
    ],
    correct: 3,
  },
  {
    q: "Sur un terrain KAMBRIQ VEFIL\u2122, l'acheteur est-il propriétaire à la signature ?",
    a: [
      'Oui, immédiatement',
      "Oui, après versement de l'acompte",
      "Non, il faut attendre la fin de l'immatriculation ET du lotissement",
      'Oui, après le bornage',
    ],
    correct: 2,
  },
  {
    q: 'Un document ajouté à une parcelle est marqué privé. Cela signifie :',
    a: ['Il est chiffré', "Il n'est pas exposé au public", 'Il est temporaire', 'Il est signé'],
    correct: 1,
  },
];

/** Module 2 — banque d'examen. */
export const MODULE_2_EXAM: SeedQuestion[] = [
  {
    q: 'Un prospect refuse de communiquer son budget. Quelle approche est la plus efficace ?',
    a: [
      'Proposer une fourchette et observer sa réaction',
      "Insister jusqu'à obtenir le chiffre",
      'Envoyer le catalogue entier',
      "Clore l'échange",
    ],
    correct: 0,
  },
  {
    q: 'Un client compare votre parcelle à une offre sans titre foncier moins chère. Que faire ?',
    a: [
      'Aligner le prix',
      "Expliquer ce que le titre garantit et ce que l'autre offre n'assure pas",
      'Dénigrer le concurrent',
      'Changer de sujet',
    ],
    correct: 1,
  },
  {
    q: "Vous découvrez qu'un lead a déjà été enregistré par un autre agent. Vous devez :",
    a: [
      'Créer un doublon',
      'Modifier le lead existant à votre nom',
      "Respecter l'attribution existante et le signaler",
      'Contacter le client sans le dire',
    ],
    correct: 2,
  },
  {
    q: 'Le client demande un engagement écrit sur un délai que vous ignorez. Vous répondez :',
    a: [
      'En donnant une date approximative',
      'En promettant le délai le plus court',
      'En laissant sans réponse',
      'En vous engageant seulement sur ce qui est officiellement confirmé',
    ],
    correct: 3,
  },
  {
    q: "Quel indicateur révèle le mieux la qualité d'un portefeuille de leads ?",
    a: [
      'Le taux de conversion en réservations',
      'Le nombre total de leads',
      "Le nombre d'appels passés",
      'La taille de la zone couverte',
    ],
    correct: 0,
  },
  {
    q: 'Une commission est enregistrée avec un niveau supérieur à zéro. Cela traduit :',
    a: [
      'Une erreur de saisie',
      'Une rémunération liée à un niveau de réseau',
      'Une pénalité',
      'Un acompte',
    ],
    correct: 1,
  },
  {
    q: 'Un agent promet une remise non autorisée pour conclure. La conséquence est :',
    a: [
      'Une vente plus rapide sans risque',
      'Une commission accrue',
      "Un engagement non tenable qui expose KAMBRIQ et l'agent",
      'Aucune, si le client est satisfait',
    ],
    correct: 2,
  },
  {
    q: 'Le meilleur moment pour aborder les documents nécessaires est :',
    a: [
      'Après le versement',
      'Au moment de la signature',
      "Jamais, l'administration s'en charge",
      'Tôt, pour éviter un blocage du dossier',
    ],
    correct: 3,
  },
  {
    q: 'Un prospect converti mais dont le dossier stagne doit être :',
    a: [
      'Relancé avec un point précis sur la pièce manquante',
      'Marqué perdu',
      'Transféré',
      "Ignoré jusqu'à son retour",
    ],
    correct: 0,
  },
  {
    q: "Que révèle un taux d'objections élevé sur le prix ?",
    a: [
      'Un mauvais produit',
      'Une valeur mal démontrée en amont',
      'Un marché saturé',
      'Un problème technique',
    ],
    correct: 1,
  },
  {
    q: "Face à un client qui exige une garantie de plus-value, l'agent doit :",
    a: [
      'La donner par écrit',
      "L'accorder oralement",
      "Expliquer qu'aucune plus-value ne peut être garantie",
      'Proposer un rachat',
    ],
    correct: 2,
  },
  {
    q: "Le suivi d'un client après remise des documents sert principalement à :",
    a: [
      'Facturer un service',
      'Reprendre le bien',
      'Modifier le prix',
      'Entretenir la relation et générer des recommandations',
    ],
    correct: 3,
  },
  {
    q: 'Une réservation annulée par le client doit être enregistrée avec :',
    a: ["Un motif d'annulation", 'Une remise', 'Un nouveau client', 'Une nouvelle parcelle'],
    correct: 0,
  },
  {
    q: "Quel est l'effet d'un dossier client incomplet sur le parcours de vente ?",
    a: [
      'Aucun',
      'Il bloque le passage aux étapes suivantes',
      'Il augmente la commission',
      'Il accélère la signature',
    ],
    correct: 1,
  },
  {
    q: "Un agent doit-il conserver une copie personnelle des pièces d'identité d'un client ?",
    a: [
      'Oui, pour ses archives',
      'Oui, si le client accepte',
      'Non, elles restent dans le dossier prévu à cet effet',
      'Oui, pendant un an',
    ],
    correct: 2,
  },
  {
    q: "La progression de niveau d'un agent récompense :",
    a: [
      'Sa présence en ligne',
      'Son nombre de leads',
      'Sa région',
      'Son volume de ventes effectivement réalisées',
    ],
    correct: 3,
  },
  {
    q: 'Un client mécontent menace de saisir un avocat. La bonne réaction est :',
    a: [
      'Documenter précisément et remonter le dossier',
      'Promettre un remboursement',
      'Nier le problème',
      'Cesser toute communication',
    ],
    correct: 0,
  },
  {
    q: "Pourquoi tracer chaque étape d'une réservation ?",
    a: [
      'Pour le référencement',
      'Pour prouver ce qui a été fait et quand, en cas de litige',
      'Pour calculer la TVA',
      'Pour publier la parcelle',
    ],
    correct: 1,
  },
  {
    q: 'Un lead supprimé par erreur doit être :',
    a: [
      'Recréé avec de fausses données',
      'Oublié',
      'Signalé pour restauration selon la procédure',
      'Remplacé par un autre',
    ],
    correct: 2,
  },
  {
    q: "L'argument le plus solide face à un acheteur de la diaspora est :",
    a: [
      'Le prix au mètre carré',
      'La rapidité de la transaction',
      'La proximité de la ville',
      'La sécurité juridique vérifiable à distance',
    ],
    correct: 3,
  },
  {
    q: 'Un prospect a été relancé cinq fois sans réponse. La bonne pratique est de :',
    a: [
      'Continuer chaque jour',
      'Le passer en perdu avec un motif et cesser les relances',
      'Le transférer sans le dire',
      'Le supprimer',
    ],
    correct: 1,
  },
  {
    q: "Un client accepte oralement mais ne fournit aucun document. L'étape suivante est :",
    a: [
      'Enregistrer la vente',
      'Calculer la commission',
      'Obtenir les pièces avant tout enregistrement',
      'Réserver la parcelle définitivement',
    ],
    correct: 2,
  },
  {
    q: "Quel est le principal signal d'achat lors d'un entretien ?",
    a: [
      "Le client interroge les modalités concrètes d'acquisition",
      'Le client écoute en silence',
      'Le client demande le catalogue',
      'Le client parle du marché en général',
    ],
    correct: 0,
  },
  {
    q: 'Un agent découvre une erreur de prix affichée en faveur du client. Il doit :',
    a: [
      'Honorer le prix erroné',
      'Modifier le prix sans prévenir',
      'Laisser le client décider',
      "Signaler l'erreur avant tout engagement",
    ],
    correct: 3,
  },
  {
    q: 'Le rôle du sponsor dans le réseau KAMNET est :',
    a: [
      'De percevoir une commission liée au niveau de réseau',
      'De valider les ventes',
      'De fixer les prix',
      'De gérer les dossiers clients',
    ],
    correct: 0,
  },
  {
    q: 'Une commission au statut PENDING signifie :',
    a: [
      'Elle est payée',
      'Elle est enregistrée mais pas encore validée',
      'Elle est annulée',
      'Elle est contestée',
    ],
    correct: 1,
  },
  {
    q: "Face à un client qui demande une exclusivité territoriale, l'agent :",
    a: [
      "L'accorde verbalement",
      "L'accorde par écrit",
      "Explique qu'aucune exclusivité n'est accordée hors cadre officiel",
      'Augmente le prix',
    ],
    correct: 2,
  },
  {
    q: 'Le meilleur moyen de réduire les annulations de réservation est :',
    a: [
      'De baisser les prix',
      'De limiter les visites',
      'De raccourcir les délais',
      'De qualifier sérieusement en amont',
    ],
    correct: 3,
  },
  {
    q: 'Un client demande si KAMBRIQ garantit un rendement locatif. La réponse est :',
    a: [
      "Aucun rendement n'est garanti",
      'Oui, 8 % par an',
      'Oui, selon la région',
      'Oui, après trois ans',
    ],
    correct: 0,
  },
  {
    q: "Que doit faire un agent qui reçoit une pièce d'identité par messagerie personnelle ?",
    a: [
      'La conserver sur son téléphone',
      'La déposer dans le dossier prévu et ne pas la conserver ailleurs',
      'La transférer à un collègue',
      'La supprimer sans traitement',
    ],
    correct: 1,
  },
];

/**
 * Deterministic placement of the correct answer.
 *
 * The authored data always lists answers in a fixed order with `correct` naming
 * the right one. The seed rotates that array so the correct answer lands at a
 * position derived from the question's global index, never from Math.random():
 * the seed must be reproducible, and a random position would make two runs
 * differ.
 *
 * An earlier draft used `isCorrect: index === 0` for every question, which made
 * the seed unable to detect the bug it exists to detect: a grader that always
 * marks the first option correct would have passed every test written against
 * that data. A test that cannot fail is worse than no test.
 *
 * Trade accepted deliberately: a determined tester could learn this pattern.
 * On a dev seed that is worth less than reproducibility, and it is recorded in
 * the register so nobody rediscovers it as a finding.
 *
 * 8-element cycle, each position twice, no two adjacent alike. 120 questions is
 * 15 whole cycles, so the distribution is exactly 30 per position.
 */
export const POSITION_CYCLE = [0, 1, 2, 3, 2, 3, 0, 1] as const;

export const targetPosition = (globalIndex: number): number =>
  POSITION_CYCLE[globalIndex % POSITION_CYCLE.length] as number;

/** Returns the four answers ordered so the correct one sits at `targetPosition(i)`. */
export const orderAnswers = (
  question: SeedQuestion,
  globalIndex: number,
): Array<{ text: string; isCorrect: boolean }> => {
  const target = targetPosition(globalIndex);
  const correctText = question.a[question.correct];
  const wrong = question.a.filter((_, i) => i !== question.correct);

  const out: Array<{ text: string; isCorrect: boolean }> = [];
  let w = 0;
  for (let pos = 0; pos < 4; pos++) {
    out.push(
      pos === target
        ? { text: correctText, isCorrect: true }
        : { text: wrong[w++] as string, isCorrect: false },
    );
  }
  return out;
};
