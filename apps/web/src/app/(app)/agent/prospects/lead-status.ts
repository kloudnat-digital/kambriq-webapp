import { KamnetLeadStatus, KAMNET_VALID_LEAD_TRANSITIONS } from '@kambriq/common/constants/kamnet';

/**
 * How a prospect's status is shown, and which moves the screen may offer.
 *
 * ---------------------------------------------------------------------------
 * Why there is no colour map here
 * ---------------------------------------------------------------------------
 * `KBS_STATUS_TONE` in `lib/kbs.ts` is the shape this deliberately avoids:
 * `bg-blue-100 text-blue-800`, `bg-emerald-100 text-emerald-800`, and so on -
 * twenty-eight non-system colour classes in one file, existing only to tint
 * status pills. Subject J10 counts 1226 such occurrences across `apps/web/src`
 * already, and this screen adds none.
 *
 * The five states are distinguished through semantic tokens instead, which the
 * application already does in four places (`bg-success/10 text-success` in
 * `verify-certificate`, `admin/verify`, `kamnet/apply` and `lands-table`):
 *
 *   NEW        muted      - arrived, nothing done yet
 *   CONTACTED  primary    - the agent has acted; primary is the action colour
 *   QUALIFIED  gold       - worth pursuing, the brand's value colour
 *   CONVERTED  success    - the outcome the pipeline exists for
 *   LOST       destructive - closed without an outcome
 *
 * ---------------------------------------------------------------------------
 * Why the transitions are imported rather than restated
 * ---------------------------------------------------------------------------
 * `KAMNET_VALID_LEAD_TRANSITIONS` is the table the API enforces in
 * `leads.service.update`. Writing a second copy here is how a screen comes to
 * offer a button that produces a 400 - the "string literal where a constant
 * exists" defect, one layer up. The screen offers exactly what the server
 * accepts because it reads the same table.
 *
 * Note this is a PRESENTATION constraint, not a guard. The server is the guard.
 */

/** Tone classes per status. Tokens only, no palette families. */
const TONE: Record<string, string> = {
  [KamnetLeadStatus.NEW]: 'bg-muted text-muted-foreground',
  [KamnetLeadStatus.CONTACTED]: 'bg-primary/10 text-primary',
  [KamnetLeadStatus.QUALIFIED]: 'bg-gold/15 text-gold-800',
  [KamnetLeadStatus.CONVERTED]: 'bg-success/10 text-success',
  [KamnetLeadStatus.LOST]: 'bg-destructive/10 text-destructive',
};

/**
 * A status the five do not cover still renders, and renders visibly.
 *
 * A row whose status is outside the enum - a value added to the schema and not
 * here, or a row written before a rename - must not produce a blank pill. It
 * gets the neutral tone and its own raw value as the label, which is ugly on
 * purpose: an operator should see that something is wrong rather than see
 * nothing.
 */
export const toneFor = (status: string): string => TONE[status] ?? 'bg-muted text-muted-foreground';

/** The order the five are offered in, so the filter and the list agree. */
export const LEAD_STATUSES: readonly string[] = [
  KamnetLeadStatus.NEW,
  KamnetLeadStatus.CONTACTED,
  KamnetLeadStatus.QUALIFIED,
  KamnetLeadStatus.CONVERTED,
  KamnetLeadStatus.LOST,
];

/**
 * The sentinel for "every status".
 *
 * Radix `Select` refuses `value=""`, so an all-statuses option needs a value of
 * its own. The screen this one follows, `candidates-list-content.tsx`, has no
 * such option at all: once a status is chosen the filter cannot be cleared.
 * That is a defect in the precedent, not a pattern to copy.
 */
export const ALL_STATUSES = 'ALL';

/** The moves the server will accept out of `status`, and nothing else. */
export const transitionsFrom = (status: string): readonly string[] =>
  KAMNET_VALID_LEAD_TRANSITIONS[status] ?? [];

/**
 * Is this string one of the five the API accepts?
 *
 * A query string carries whatever somebody types into the address bar, so
 * `?status=WOBBLE` must become "no filter" rather than be cast to the enum and
 * sent on. `LeadFilters.status` is the union, and casting into it would make
 * `tsc` agree with a value the API refuses - the "type that lies" defect this
 * repository has already paid for twice.
 */
export const isLeadStatus = (value: string): value is KamnetLeadStatus =>
  (LEAD_STATUSES as readonly string[]).includes(value);
