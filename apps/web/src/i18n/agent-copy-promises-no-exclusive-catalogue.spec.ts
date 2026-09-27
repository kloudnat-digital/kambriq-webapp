import fr from '@/i18n/messages/fr.json';
import en from '@/i18n/messages/en.json';

/**
 * P10 - the KBS and KAMNET pages must not tell a candidate agent that
 * certification opens an exclusive catalogue, exclusive rights or catalogue
 * access. None exists.
 *
 * The first version of this pin named the three strings the register row
 * named, and a third promise on the same page went on saying "réseau exclusif
 * ... catalogue vérifié" beside it. So it reads every string of both product
 * pages, the class rather than the instances found.
 */
type Json = Record<string, unknown>;

const leaves = (value: unknown, prefix: string): Array<[string, string]> => {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value as Json).flatMap(([k, v]) => leaves(v, `${prefix}.${k}`));
  }
  return [];
};

const agentPages = (messages: typeof fr) => [
  ...leaves(messages.products.kbs, 'products.kbs'),
  ...leaves(messages.products.kamnet, 'products.kamnet'),
];

describe.each([
  ['fr', fr],
  ['en', en],
] as const)('P10 - %s: no exclusive catalogue is promised to agents', (_locale, messages) => {
  it('reads both product pages', () => {
    expect(agentPages(messages).length).toBeGreaterThan(100);
  });

  it('no string on them promises exclusivity or catalogue access', () => {
    expect(
      agentPages(messages)
        .filter(([, text]) => /exclusi|catalog/i.test(text))
        .map(([key, text]) => `${key} = ${text}`),
    ).toEqual([]);
  });
});
