jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { PlaceholderPage } from './placeholder-page';
import fr from '@/i18n/messages/fr.json';
import en from '@/i18n/messages/en.json';

/**
 * I43 - a screen that is not built says so, and promises nothing.
 *
 * Ten signed-in screens listed "Fonctionnalités prévues" - 38 features in all,
 * among them "Export des relevés" and "Graphique des commissions (6 derniers
 * mois)", none of which exists - and their card said the page was "en cours de
 * développement", which nobody is. Under the list, "Rôles autorisés" showed
 * `ROOT` and `OPS`, two roles the platform does not have. The ten KAMNET agents
 * signing in for the first time would have read all of it, in French whatever
 * their language.
 *
 * What stays is exactly three things, each from the translations: the screen's
 * name, and the statement that it is not built. The assertion is on the WHOLE
 * text of the screen, so a list, a subtitle describing what it would do, or a
 * row of roles cannot come back under a new name.
 *
 * The screens are found by reading `src/app` for the import, not listed here.
 */
const APP = join(__dirname, '..', 'app');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const SCREENS = walk(APP)
  .filter((f) => f.endsWith('page.tsx'))
  .filter((f) => /^import \{ PlaceholderPage \}/m.test(readFileSync(f, 'utf8')))
  .map((f) => relative(APP, f));

type Catalogue = typeof fr;
const at = (messages: Catalogue, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)?.[k], messages);

/** The element a placeholder screen returns, rendered - it is an async server component. */
const renderScreen = async (file: string) => {
  const Page = (require(join(APP, file)) as { default: () => ReactElement }).default;
  const element = Page() as ReactElement<Parameters<typeof PlaceholderPage>[0]>;
  expect(element.type).toBe(PlaceholderPage);
  render(await PlaceholderPage(element.props));
  return element.props;
};

describe('I43 - the screens that are not built', () => {
  it('are found where they are, and there are the ten measured on 25 September', () => {
    expect(SCREENS.sort()).toEqual(
      [
        '[locale]/(app)/admin/escalations/page.tsx',
        '[locale]/(app)/admin/kamnet/page.tsx',
        '[locale]/(app)/admin/reservations/page.tsx',
        '[locale]/(app)/agent/commissions/page.tsx',
        '[locale]/(app)/agent/dashboard/page.tsx',
        '[locale]/(app)/agent/escalation/new/page.tsx',
        '[locale]/(app)/client/verify/page.tsx',
        '[locale]/(app)/profile/page.tsx',
        '[locale]/(app)/settings/page.tsx',
        '[locale]/(app)/welcome/page.tsx',
      ].sort(),
    );
  });

  describe.each([
    ['fr', fr],
    ['en', en],
  ] as const)('%s', (locale, messages) => {
    beforeEach(() => setTestLocale(locale));

    it.each(SCREENS)('%s says only its name and that it is not built', async (file) => {
      const props = await renderScreen(file);
      const { container } = { container: document.body };

      const expected = [
        at(messages, `${props.namespace}.${props.titleKey}`),
        messages.app.notBuilt.title,
        messages.app.notBuilt.description,
      ];
      expect(expected.every((s) => typeof s === 'string' && s.length > 0)).toBe(true);
      expect(container.textContent).toBe(expected.join(''));
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });
  });
});
