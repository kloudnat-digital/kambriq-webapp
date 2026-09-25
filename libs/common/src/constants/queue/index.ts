// Domain queues.
export const QUEUES = {
  KBS: 'kbs',
  CORE: 'core',
  KAMNET: 'kamnet',
  NOTIFICATIONS: 'notifications',
  /** Dunning sweep queue. Isolated to satisfy BullMQ's processor-based routing. */
  DUNNING: 'dunning',
} as const;

// Queue operations.
export const KBS_JOBS = {
  GRADE_EXAM: 'kbs.grade-exam',
  AUTO_TRANSITION_STATUS: 'kbs.auto-transition-status',
  EXPIRE_EXAM: 'kbs.expire-exam',
  /** Daily revocation of KCA_CERTIFIED status upon certificate expiration. */
  WITHDRAW_EXPIRED_CERTIFICATIONS: 'kbs.withdraw-expired-certifications',
} as const;

export const CORE_JOBS = {
  CLEANUP_EXPIRED_TOKENS: 'core.cleanup-expired-tokens',
  PURGE_DELETED_USERS: 'core.purge-deleted-users',
  /** Daily contact-request digest. */
  CONTACT_DIGEST: 'core.contact-digest',
} as const;

export const NOTIFICATIONS_JOBS = {
  SEND_EMAIL: 'notifications.send-email',
} as const;

export const DUNNING_JOBS = {
  /** Daily sweep for reminders and expiries (BullMQ repeatable). */
  SWEEP: 'dunning.sweep',
} as const;

export const KAMNET_JOBS = {
  SALE_COMPLETED: 'kamnet.sale-completed',
} as const;

// Reserved for future lands notification/sync worker.
export const LAND_JOBS = {
  NOTIFY_CLIENT_PORTAL: 'land.notify-client-portal',
  SYNC_RESERVATION_STATUS: 'land.sync-reservation-status',
} as const;
