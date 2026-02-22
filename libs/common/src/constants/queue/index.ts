// ----- Queue names - One queue per domain concern -----
export const QUEUES = {
  KBS: 'kbs',
  NOTIFICATIONS: 'notifications',
} as const;

// ----- Job names - specific operations within queues -----
export const KBS_JOBS = {
  GRADE_EXAM: 'kbs.grade-exam',
  GRANT_KCA_ROLE: 'kbs.grant-kca-role',
  AUTO_TRANSITION_STATUS: 'kbs.auto-transition-status',
} as const;

export const NOTIFICATIONS_JOBS = {
  SEND_EMAIL: 'notifications.send-email',
} as const;
