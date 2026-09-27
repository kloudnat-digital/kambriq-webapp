import { Users } from 'lucide-react';

/**
 * What an agent with no referrals sees.
 *
 * Deliberate rather than an empty grid, because the two say different things. A
 * grid with nothing in it reads as a screen that failed to load; this says "you
 * have not sponsored anybody yet" and explains how sponsorship happens. It is
 * also what a user who is not an agent at all sees, and what a failed read
 * shows - the page never fills the gap with invented agents.
 *
 * Synchronous, and it takes its strings as props rather than calling
 * `getTranslations` itself. An async child component cannot be resolved by
 * React when its parent's output is rendered directly in a test, so an async
 * version of this file left `[data-network="empty"]` out of the DOM while the
 * page looked correct in the browser. The page fetches translations once and
 * passes them down; that is both testable and one fewer catalogue read.
 *
 * Structure follows `compare-empty.tsx`, the repository's only other empty
 * state. Its colours do not: that file carries `text-gray-900` and
 * `text-gray-500`, which are outside the design system, so tokens are used here.
 */
export const NetworkEmpty = ({ title, message }: { title: string; message: string }) => (
  <div
    data-network="empty"
    className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-24 text-center"
  >
    <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary-500/10">
      <Users className="size-10 text-primary-500" />
    </div>
    <h2 className="mb-3 text-xl font-semibold text-foreground">{title}</h2>
    <p className="max-w-md text-sm text-muted-foreground">{message}</p>
  </div>
);
