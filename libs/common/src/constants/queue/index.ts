// ----- Queue names - One queue per domain concern -----
export const QUEUES = {
  KBS: 'kbs',
  CORE: 'core',
  KAMNET: 'kamnet',
  NOTIFICATIONS: 'notifications',
  /**
   * G6's dunning sweep. **Its own queue, and that is not tidiness.**
   *
   * BullMQ allows one `@Processor` per queue name. Putting the sweep on
   * `notifications` added a second processor beside `EmailProcessor`, and
   * whichever won a given job kept it - so the dunning processor, which returns
   * `undefined` for anything that is not the sweep, **silently consumed and
   * discarded a reminder email**. One email sent, queue drained, `failed` set
   * empty, nothing logged.
   *
   * Found by running it end to end and counting the messages that arrived, not
   * by reading the code. A chantier whose whole subject is "nothing may fail
   * silently" had introduced exactly that.
   */
  DUNNING: 'dunning',
} as const;

// ----- Job names - specific operations within queues -----
export const KBS_JOBS = {
  GRADE_EXAM: 'kbs.grade-exam',
  AUTO_TRANSITION_STATUS: 'kbs.auto-transition-status',
  EXPIRE_EXAM: 'kbs.expire-exam',
} as const;

export const CORE_JOBS = {
  CLEANUP_EXPIRED_TOKENS: 'core.cleanup-expired-tokens',
  PURGE_DELETED_USERS: 'core.purge-deleted-users',
} as const;

export const NOTIFICATIONS_JOBS = {
  SEND_EMAIL: 'notifications.send-email',
} as const;

export const DUNNING_JOBS = {
  /**
   * `G6`'s daily sweep: reminders that are due, then expiries at term.
   *
   * A BullMQ repeatable job rather than a `@nestjs/schedule` cron, and that is
   * the point of the chantier: a repeatable job that throws lands on the
   * queue's `failed` set with its payload, where `A18`'s endpoint can read it.
   * A `@Cron` that throws writes a log line nobody is watching.
   */
  SWEEP: 'dunning.sweep',
} as const;

export const KAMNET_JOBS = {
  SALE_COMPLETED: 'kamnet.sale-completed',
} as const;

// TODO: No LandsProcessor exists yet. These job names are reserved for a future
// lands notification/sync queue worker (v2).
export const LAND_JOBS = {
  NOTIFY_CLIENT_PORTAL: 'land.notify-client-portal',
  SYNC_RESERVATION_STATUS: 'land.sync-reservation-status',
} as const;
