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
 * Global mock URL state shared across all hook instances.
 * Must be reset between tests via `resetTestQueryState()` to prevent test pollution.
 */
let state: QueryState = {};

export const resetTestQueryState = (initial: QueryState = {}) => {
  state = { ...initial };
};

/** Exposes current mock URL state for test assertions. */
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
