import { resetBudget } from './auth-budget';

/** A56: every run starts from an empty auth window. */
export default async function globalSetup(): Promise<void> {
  resetBudget();
}
