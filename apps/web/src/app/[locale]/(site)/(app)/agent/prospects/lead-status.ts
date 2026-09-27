import { KamnetLeadStatus, KAMNET_VALID_LEAD_TRANSITIONS } from '@kambriq/common/constants/kamnet';

/**
 * Maps lead statuses to semantic UI tokens and valid API transitions.
 *
 * To ensure consistency with the backend, `KAMNET_VALID_LEAD_TRANSITIONS`
 * is used to determine available status transitions on the client side.
 */

/** Maps each status to its corresponding semantic color tokens. */
const TONE: Record<string, string> = {
  [KamnetLeadStatus.NEW]: 'bg-muted text-muted-foreground',
  [KamnetLeadStatus.CONTACTED]: 'bg-primary/10 text-primary',
  [KamnetLeadStatus.QUALIFIED]: 'bg-gold/15 text-gold-800',
  [KamnetLeadStatus.CONVERTED]: 'bg-success/10 text-success',
  [KamnetLeadStatus.LOST]: 'bg-destructive/10 text-destructive',
};

/**
 * Returns the CSS classes for a given status.
 * Unrecognized statuses fallback to a neutral tone to ensure visibility.
 */
export const toneFor = (status: string): string => TONE[status] ?? 'bg-muted text-muted-foreground';

/** Ordered list of statuses used for filtering and display. */
export const LEAD_STATUSES: readonly string[] = [
  KamnetLeadStatus.NEW,
  KamnetLeadStatus.CONTACTED,
  KamnetLeadStatus.QUALIFIED,
  KamnetLeadStatus.CONVERTED,
  KamnetLeadStatus.LOST,
];

/** Sentinel value representing "All Statuses" in filter dropdowns. */
export const ALL_STATUSES = 'ALL';

/** Returns the allowed transitions for a given status according to API constraints. */
export const transitionsFrom = (status: string): readonly string[] =>
  KAMNET_VALID_LEAD_TRANSITIONS[status] ?? [];

/** Type guard to validate whether a query string parameter matches a known lead status. */
export const isLeadStatus = (value: string): value is KamnetLeadStatus =>
  (LEAD_STATUSES as readonly string[]).includes(value);
