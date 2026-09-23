import type { ReactNode } from 'react';

/**
 * Mock implementation of `nuqs` for Jest tests.
 * Maintains an internal state object to simulate real URL query behavior,
 * avoiding the false positives of a stateless mock.
 *
 * Usage:
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
