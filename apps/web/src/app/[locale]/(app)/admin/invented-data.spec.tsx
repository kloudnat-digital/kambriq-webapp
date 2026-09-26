jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));

import { isValidElement, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { PlaceholderPage } from '@/components/placeholder-page';
import LandsSearchPage from './lands/search/page';
import CompareLandsPage from './lands/compare/page';
import VerifyAdminPage from './verify/page';

/**
 * I44 - the administration screens show no invented data.
 *
 * `/admin/lands/search` and `/admin/lands/compare` rendered `data/mock-lands.ts` (deleted in A53) -
 * parcels with invented titles, prices and title numbers - and `/admin/verify`
 * rendered four invented verification requests under invented statistics
 * (4 pending, 3 in progress, 18 completed this month, 2 rejected). An
 * administrator read them as the business. Same lie as I43 and as the six
 * invented agents `/agent/network` once showed, moved to the back office.
 *
 * None of the three has a real source yet - VERIFY has no backend, and the
 * search and compare screens were built over the mock - so each now says what
 * it is and that it is not built (I43's placeholder). The invented values are
 * pinned out here, read from the mock itself where it still exists.
 */
const INVENTED_REQUESTS = [
  'Jean Dupont',
  'Alphonse Biya',
  'Sandra Njoh',
  'Roland Fouda',
  'Yaoundé, Bastos',
  'Kribi, Bord de Mer',
  'Yaoundé, Ekounou',
  'Douala, Bonanjo',
];
const INVENTED_STATISTICS = ['En attente', 'En cours', 'Terminées (mois)', 'Rejetées (mois)'];
/**
 * The parcels `data/mock-lands.ts` invented. The file is gone (A53), so they are
 * written out here, the way `/agent/network`'s spec keeps its six names.
 */
const INVENTED_PARCELS = [
  'Terrain Dibamba',
  'Terrain Yaoundé Bastos',
  'Terrain Bafoussam',
  'Terrain Kribi Bord de Mer',
  'TF 421/WB',
  'TF 89/MF',
  'TF 34/OC',
];

/** A page that returns a placeholder element is rendered through it; the element is async. */
const renderPage = async (Page: () => unknown) => {
  const element = Page() as ReactElement<Parameters<typeof PlaceholderPage>[0]>;
  if (isValidElement(element) && element.type === PlaceholderPage) {
    return render(await PlaceholderPage(element.props));
  }
  return render(element as ReactElement);
};

describe.each(['fr', 'en'] as const)('I44 - administration screens (%s)', (locale) => {
  beforeEach(() => setTestLocale(locale));

  it('reads the invented values it pins, so the pin is not vacuous', () => {
    expect(INVENTED_PARCELS.length).toBeGreaterThan(4);
  });

  it.each([
    ['/admin/lands/search', LandsSearchPage],
    ['/admin/lands/compare', CompareLandsPage],
    ['/admin/verify', VerifyAdminPage],
  ])('%s shows no invented parcel, request or statistic', async (_route, Page) => {
    const { container } = await renderPage(Page as () => unknown);
    const text = container.textContent ?? '';
    for (const value of [...INVENTED_PARCELS, ...INVENTED_REQUESTS, ...INVENTED_STATISTICS]) {
      expect(text).not.toContain(value);
    }
    expect(container.querySelectorAll('table, li')).toHaveLength(0);
  });
});
