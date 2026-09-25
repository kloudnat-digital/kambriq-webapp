/**
 * The translation catalogue, read the way a copy guard should read it: every
 * namespace is watched unless it is declared exempt, with its reason.
 *
 * A guard over a hand-kept list of namespaces covers the list, not the site -
 * a page added next month is unwatched until somebody remembers to add it. So
 * the list a guard keeps is the list of EXCEPTIONS, and anything new is covered
 * the day it is written. Shared so that each guard does not grow its own copy
 * of this mechanism (P27; P21's list was the hand-kept kind).
 */
export type Json = Record<string, unknown>;

/** Every string in a catalogue subtree, with its dotted key. */
export const leaves = (value: unknown, prefix: string): Array<[string, string]> => {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value as Json).flatMap(([k, v]) =>
      leaves(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
};

/** The namespaces a guard reads: all of them, minus the declared exemptions. */
export const watchedNamespaces = (messages: unknown, exempt: Record<string, string>): string[] =>
  Object.keys(messages as Json).filter((ns) => !(ns in exempt));

/** Every string a guard reads, with its key. */
export const watchedCopy = (
  messages: unknown,
  exempt: Record<string, string>,
): Array<[string, string]> =>
  watchedNamespaces(messages, exempt).flatMap((ns) => leaves((messages as Json)[ns], ns));

/** Exemptions that name no namespace are stale, and a stale exemption hides nothing on purpose. */
export const staleExemptions = (messages: unknown, exempt: Record<string, string>): string[] =>
  Object.keys(exempt).filter((ns) => !(ns in (messages as Json)));
