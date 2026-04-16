/**
 * Core user profile shared across session, store, and API responses.
 */
declare type TUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  language: string;
};
