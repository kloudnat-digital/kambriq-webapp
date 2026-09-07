/**
 * The six channels money actually arrives by, and the one that records rows
 * taken over from the old model.
 *
 * Specification: `ops_kambriq_paiement-hybride_v03`, section 4b.
 *
 * ---------------------------------------------------------------------------
 * The code and the label are two different things, stored separately
 * ---------------------------------------------------------------------------
 * The **code** is what a person says down a telephone and writes on a
 * paying-in slip. The **label** is what a screen shows. Neither is derived from
 * the other by string manipulation: `'OMO'.toLowerCase()` is not "Orange
 * Money", and any code that tried would be one rename away from lying.
 *
 * So this file is the one place both live, side by side, and the row stores the
 * code.
 *
 * ---------------------------------------------------------------------------
 * Why mobile money is two channels
 * ---------------------------------------------------------------------------
 * Orange and MTN have neither the same number, nor the same confirmation
 * format, nor the same dispute procedure. Collapsing them under one label
 * discards the information at the moment it is needed - which is when a
 * payment is disputed, not when it is recorded.
 *
 * `OMO` and `MOMO` existed before this platform and everyone in Cameroon knows
 * them. They are taken as given rather than renamed.
 *
 * ---------------------------------------------------------------------------
 * Why VIR and DEPO are deliberately far apart when spoken
 * ---------------------------------------------------------------------------
 * "Virement" and "versement" are confusable over a telephone, and the two
 * channels share neither their proof nor their payer. A transfer leaves the
 * client's own account and carries their name; a deposit is made in cash at a
 * counter, often by somebody else entirely.
 */
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
  /**
   * Historique, canal inconnu. Pre-v03 rows only.
   *
   * The old model recorded no channel, so rows taken over from it genuinely do
   * not have one - this says so rather than inventing "virement". A CHECK
   * constraint confines it to the only rows allowed to omit their proof, and
   * nothing offers it in a list a person can choose from.
   */
  HIST = 'HIST',
}

export type ChannelDefinition = {
  /** Said on the telephone, written on a slip. Never computed from the label. */
  readonly code: PaymentChannel;
  /** Shown on a screen. Never computed from the code. */
  readonly label: string;
  /** What a receipt on this channel has to be evidenced by. */
  readonly proof: string;
  /**
   * True where the person who paid is routinely **not** the client.
   *
   * A deposit is made at a counter by whoever happens to be in Cameroon - a
   * relative in Douala, a friend passing through. The back office then looks at
   * a slip bearing a stranger's name, and without a recorded payer it cannot
   * match it to anything. See `paidBy` on `PaymentReceipt`.
   */
  readonly payerMayDiffer: boolean;
  /** False for `HIST`: it is a record of the past, never an option. */
  readonly selectable: boolean;
};

/** The single registry. Code, label and proof, written once, beside each other. */
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

/**
 * The six a person may pick, derived from `selectable` rather than listed again.
 *
 * A second hand-written list is a second thing to forget: the day a channel is
 * added, one of the two lists gets it.
 */
export const SELECTABLE_CHANNELS: readonly PaymentChannel[] = Object.values(PAYMENT_CHANNELS)
  .filter((c) => c.selectable)
  .map((c) => c.code);

/** Channels a caller may record a receipt against. Same set, same reason. */
export const RECORDABLE_CHANNELS: readonly PaymentChannel[] = SELECTABLE_CHANNELS;

/** Channels whose payer is routinely somebody other than the client. */
export const PAYER_MAY_DIFFER_CHANNELS: readonly PaymentChannel[] = Object.values(PAYMENT_CHANNELS)
  .filter((c) => c.payerMayDiffer)
  .map((c) => c.code);

/** True when a receipt on this channel must name who actually paid. */
export const requiresPaidBy = (channel: PaymentChannel): boolean =>
  PAYMENT_CHANNELS[channel].payerMayDiffer;

/** The label, from the registry. There is no other way to obtain it. */
export const channelLabel = (channel: PaymentChannel): string => PAYMENT_CHANNELS[channel].label;

/**
 * The separator between a reference and a channel code on anything a human
 * reads.
 *
 * **A hyphen is forbidden here.** The reference is `KBQ-2609-7F3K2-B`, four
 * hyphen-separated segments, and `KBQ-2609-7F3K2-B-OMO` reads as a fifth. A
 * middle dot cannot be mistaken for one: `KBQ-2609-7F3K2-B · OMO`.
 *
 * The channel is never *inside* the reference. A client announces mobile money,
 * changes their mind and makes a transfer - which will happen often - and an
 * identifier carrying information that can change either has to be reissued or
 * left to lie. Two references for one payment is the dispute this format exists
 * to prevent.
 */
export const REFERENCE_CHANNEL_SEPARATOR = ' · ';

/**
 * `KBQ-2609-7F3K2-B · OMO`, for documents and screens where a person reads both.
 *
 * The only sanctioned way to put the two together. `no-channel-in-reference.spec.ts`
 * fails if any other code concatenates a channel onto a reference, and fails
 * specifically on a hyphen.
 */
export const formatReferenceWithChannel = (reference: string, channel: PaymentChannel): string =>
  `${reference}${REFERENCE_CHANNEL_SEPARATOR}${channel}`;
