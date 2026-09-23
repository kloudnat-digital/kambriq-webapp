// ----- Queue names - One queue per domain concern -----
export const QUEUES = {
  KBS: 'kbs',
  CORE: 'core',
  KAMNET: 'kamnet',
  NOTIFICATIONS: 'notifications',
  /** Dunning sweep queue. Kept separate because BullMQ routes jobs based on processor names. */
  DUNNING: 'dunning',
} as const;

// ----- Job names - specific operations within queues -----
export const KBS_JOBS = {
  GRADE_EXAM: 'kbs.grade-exam',
  AUTO_TRANSITION_STATUS: 'kbs.auto-transition-status',
  EXPIRE_EXAM: 'kbs.expire-exam',
  /** Daily job to withdraw KCA_CERTIFIED status from holders whose certificate has expired. */
  WITHDRAW_EXPIRED_CERTIFICATIONS: 'kbs.withdraw-expired-certifications',
} as const;

export const CORE_JOBS = {
  CLEANUP_EXPIRED_TOKENS: 'core.cleanup-expired-tokens',
  PURGE_DELETED_USERS: 'core.purge-deleted-users',
  /** Daily contact-request digest job. */
  CONTACT_DIGEST: 'core.contact-digest',
} as const;

export const NOTIFICATIONS_JOBS = {
  SEND_EMAIL: 'notifications.send-email',
} as const;

export const DUNNING_JOBS = {
  /** Daily sweep job for due reminders and expiries. Processed via a BullMQ repeatable job. */
  SWEEP: 'dunning.sweep',
} as const;

export const KAMNET_JOBS = {
  SALE_COMPLETED: 'kamnet.sale-completed',
} as const;

// Job names reserved for future lands notification/sync queue worker.
export const LAND_JOBS = {
  NOTIFY_CLIENT_PORTAL: 'land.notify-client-portal',
  SYNC_RESERVATION_STATUS: 'land.sync-reservation-status',
} as const;
