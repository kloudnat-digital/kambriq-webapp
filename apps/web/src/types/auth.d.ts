/**
 * Signal emitted by authorize() indicating an account requires reactivation.
 * Triggered when a user attempts to log in during the soft-deletion grace period.
 */
declare type ReactivationSignal = {
  code: 'REACTIVATION_REQUIRED';
  userId: string;
  daysRemaining: number;
};
