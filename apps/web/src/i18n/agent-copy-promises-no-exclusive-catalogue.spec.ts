import fr from '@/i18n/messages/fr.json';
import en from '@/i18n/messages/en.json';

/**
 * P10 - the KBS and KAMNET pages told candidate agents that certification opens
 * an exclusive catalogue of verified land and exclusive rights to distribute
 * it. Neither exists. The two strings that said so were replaced with copy
 * Visquis validated on 26 September; this pins that they cannot drift back.
 */
const STRINGS = (messages: typeof fr) => ({
  'products.kbs.whyKbs.network.description': messages.products.kbs.whyKbs.network.description,
  'products.kamnet.whyAgent.exclusiveAccess.title':
    messages.products.kamnet.whyAgent.exclusiveAccess.title,
  'products.kamnet.whyAgent.exclusiveAccess.description':
    messages.products.kamnet.whyAgent.exclusiveAccess.description,
});

describe.each([
  ['fr', fr],
  ['en', en],
] as const)('P10 - %s: no exclusive catalogue is promised to agents', (_locale, messages) => {
  it.each(Object.entries(STRINGS(messages)))('%s', (_key, text) => {
    expect(text).not.toMatch(/exclusi|catalog/i);
  });
});
