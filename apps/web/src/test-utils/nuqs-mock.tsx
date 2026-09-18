import type { ReactNode } from 'react';

/**
 * `nuqs`, replaced for tests - but **not** its behaviour.
 *
 * ---------------------------------------------------------------------------
 * Why a mock at all
 * ---------------------------------------------------------------------------
 * The same wall `next-intl-mock.tsx` documents, one package along. `nuqs` ships
 * ESM from `node_modules`:
 *
 *   SyntaxError: Cannot use import statement outside a module
 *   node_modules/nuqs/dist/index.js:2
 *
 * and `next/jest` builds its `transformIgnorePatterns` from `transpilePackages`
 * in `next.config.ts`. Custom patterns are only ever **appended**, and Jest
 * ignores a file when any pattern matches, so appending cannot un-ignore
 * `/node_modules/`. This repository has no `transpilePackages` entry and no
 * `moduleNameMapper`; adding `nuqs` to the first would change how the
 * production bundle is built for the sake of a test.
 *
 * So the module is replaced here, exactly as `next-intl` is.
 *
 * ---------------------------------------------------------------------------
 * What is mocked, and what deliberately is not
 * ---------------------------------------------------------------------------
 * **The state is real.** A mock returning the defaults forever would let a
 * screen pass its tests while its filter did nothing - the failure mode that
 * made `contact.spec.ts` necessary, where component tests mocked the action and
 * an action that always reported success left twelve of them green.
 *
 * `useQueryStates` therefore holds values and the setter writes them, so a test
 * that sets a status and asserts the list refetched is asserting something. The
 * page under test reads its filters from `searchParams` on the server side,
 * which is what the page spec exercises; this keeps the client half honest when
 * a component spec renders it directly.
 *
 * Usage, at the top of a test file:
 *
 *   jest.mock('nuqs', () => require('@/test-utils/nuqs-mock'));
 */

type QueryValue = string | number | null;
type QueryState = Record<string, QueryValue>;

/** Parser stand-ins. Only `withDefault` is used by this application. */
const parser = <T extends QueryValue>(coerce: (raw: string) => T) => ({
  coerce,
  withDefault(fallback: T) {
    return { ...this, defaultValue: fallback };
  },
  defaultValue: undefined as T | undefined,
});

export const parseAsString = parser<string>((raw) => raw);
export const parseAsInteger = parser<number>((raw) => Number(raw));
export const parseAsFloat = parser<number>((raw) => Number(raw));
export const parseAsBoolean = parser<string>((raw) => raw);

/**
 * The state every `useQueryStates` in one test shares.
 *
 * Module-level rather than per-hook because two components in the same render
 * read the same URL. `resetTestQueryState()` clears it between tests - without
 * that, a status set in one test leaks into the next and the second passes for
 * the wrong reason.
 */
let state: QueryState = {};

export const resetTestQueryState = (initial: QueryState = {}) => {
  state = { ...initial };
};

/** What the URL currently holds, for a test that wants to assert on it. */
export const testQueryState = (): QueryState => ({ ...state });

type Definitions = Record<string, { defaultValue?: QueryValue }>;

export const useQueryStates = (definitions: Definitions) => {
  const values: QueryState = {};
  for (const [key, def] of Object.entries(definitions)) {
    values[key] = key in state ? state[key] : (def.defaultValue ?? null);
  }

  const setValues = (patch: QueryState) => {
    state = { ...state, ...patch };
  };

  return [values, setValues] as const;
};

export const useQueryState = (key: string, def?: { defaultValue?: QueryValue }) => {
  const value = key in state ? state[key] : (def?.defaultValue ?? null);
  const set = (next: QueryValue) => {
    state = { ...state, [key]: next };
  };
  return [value, set] as const;
};

export const NuqsAdapter = ({ children }: { children: ReactNode }) => children;
