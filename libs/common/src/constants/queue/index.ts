// ----- Queue names - One queue per domain concern -----
export const QUEUES = {
  KBS: 'kbs',
  CORE: 'core',
  KAMNET: 'kamnet',
  NOTIFICATIONS: 'notifications',
} as const;

// ----- Job names - specific operations within queues -----
export const KBS_JOBS = {
  GRADE_EXAM: 'kbs.grade-exam',
  GRANT_KCA_ROLE: 'kbs.grant-kca-role',
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

export const KAMNET_JOBS = {
  SALE_COMPLETED: 'kamnet.sale-completed',
} as const;

// TODO: No LandsProcessor exists yet. These job names are reserved for a future
// lands notification/sync queue worker (v2).
export const LAND_JOBS = {
  NOTIFY_CLIENT_PORTAL: 'land.notify-client-portal',
  SYNC_RESERVATION_STATUS: 'land.sync-reservation-status',
} as const;
