/**
 * Structured signal thrown by authorize() when the API returns requiresReactivation: true.
 * The account was soft-deleted but is still within the grace period reactivation window.
 */
declare type ReactivationSignal = {
  code: 'REACTIVATION_REQUIRED';
  userId: string;
  daysRemaining: number;
};
