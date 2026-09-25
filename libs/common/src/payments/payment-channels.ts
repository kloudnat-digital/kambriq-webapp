/** Defines supported payment channels and their behavior. */
export enum PaymentChannel {
  /** Virement bancaire. */
  VIR = 'VIR',
  /** Depot d'especes sur notre compte. */
  DEPO = 'DEPO',
  /** Orange Money. */
  OMO = 'OMO',
  /** MTN Mobile Money. */
  MOMO = 'MOMO',
  /** Especes en main propre. */
  ESP = 'ESP',
  /** Paiement chez le notaire. */
  NOTA = 'NOTA',
  /** Legacy records with unknown channels. Not available for new entries. */
  HIST = 'HIST',
}

export type ChannelDefinition = {
  /** Unique identifier for the channel. */
  readonly code: PaymentChannel;
  /** Human-readable display name. */
  readonly label: string;
  /** Description of the required evidence/receipt. */
  readonly proof: string;
  /** Whether the payer frequently differs from the primary client. */
  readonly payerMayDiffer: boolean;
  /** Whether the channel accepts new transactions. */
  readonly selectable: boolean;
};

/** Registry of all payment channels and their metadata. */
export const PAYMENT_CHANNELS: Readonly<Record<PaymentChannel, ChannelDefinition>> = {
  [PaymentChannel.VIR]: {
    code: PaymentChannel.VIR,
    label: 'Virement bancaire',
    proof: 'Avis de virement, au nom du client',
    payerMayDiffer: false,
    selectable: true,
  },
  [PaymentChannel.DEPO]: {
    code: PaymentChannel.DEPO,
    label: "Depot d'especes sur notre compte",
    proof: 'Bordereau de versement, au nom du verseur',
    payerMayDiffer: true,
    selectable: true,
  },
  [PaymentChannel.OMO]: {
    code: PaymentChannel.OMO,
    label: 'Orange Money',
    proof: "Confirmation de l'operateur",
    payerMayDiffer: false,
    selectable: true,
  },
  [PaymentChannel.MOMO]: {
    code: PaymentChannel.MOMO,
    label: 'MTN Mobile Money',
    proof: "Confirmation de l'operateur",
    payerMayDiffer: false,
    selectable: true,
  },
  [PaymentChannel.ESP]: {
    code: PaymentChannel.ESP,
    label: 'Especes en main propre',
    proof: 'Recu KAMBRIQ',
    payerMayDiffer: false,
    selectable: true,
  },
  [PaymentChannel.NOTA]: {
    code: PaymentChannel.NOTA,
    label: 'Paiement chez le notaire',
    proof: 'Acte notarie',
    payerMayDiffer: false,
    selectable: true,
  },
  [PaymentChannel.HIST]: {
    code: PaymentChannel.HIST,
    label: 'Historique, canal inconnu',
    proof: 'Aucune - reserve aux lignes reprises',
    payerMayDiffer: false,
    selectable: false,
  },
};

/** List of channels available for new transactions. */
export const SELECTABLE_CHANNELS: readonly PaymentChannel[] = Object.values(PAYMENT_CHANNELS)
  .filter((c) => c.selectable)
  .map((c) => c.code);

/** Channels valid for recording new receipts. */
export const RECORDABLE_CHANNELS: readonly PaymentChannel[] = SELECTABLE_CHANNELS;

/** Channels whose payer is routinely somebody other than the client. */
export const PAYER_MAY_DIFFER_CHANNELS: readonly PaymentChannel[] = Object.values(PAYMENT_CHANNELS)
  .filter((c) => c.payerMayDiffer)
  .map((c) => c.code);

/** True when a receipt on this channel must name who actually paid. */
export const requiresPaidBy = (channel: PaymentChannel): boolean =>
  PAYMENT_CHANNELS[channel].payerMayDiffer;

/** Retrieves the display label for a given channel. */
export const channelLabel = (channel: PaymentChannel): string => PAYMENT_CHANNELS[channel].label;

/**
 * Delimiter used when displaying a reference alongside its channel.
 * Middle dot is used to visually distinct it from reference hyphens.
 */
export const REFERENCE_CHANNEL_SEPARATOR = ' · ';

/** Formats a payment reference with its channel for human-readable contexts. */
export const formatReferenceWithChannel = (reference: string, channel: PaymentChannel): string =>
  `${reference}${REFERENCE_CHANNEL_SEPARATOR}${channel}`;
