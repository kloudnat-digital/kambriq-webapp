jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/components/layout/navbar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/layout/footer', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/floating/quick-actions', () => ({ __esModule: true, default: () => null }));

import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import fr from '@/i18n/messages/fr.json';
import en from '@/i18n/messages/en.json';
import LandPage from './page';

/**
 * P10 - the LANDS page is for the buyer.
 *
 * It promised a catalogue it never shows, and told a person deciding whether to
 * buy land what the AGENT earns ("Commission rapide"). Two standing decisions
 * govern it: no parcel on a public page, ever (`docs/base/regles-produit.md`),
 * and nothing on a public page about an agent's remuneration (P9, decision 1).
 * What the page shows instead is what the buyer actually receives: the
 * rubriques of a selection dossier - headings, no values, no parcel.
 *
 * **How it renders, and why.** The page's sections are async server
 * components, and Testing Library renders nothing for an async component
 * nested in a tree - the first version of this file rendered an EMPTY page,
 * and its "contains no catalogue" assertions passed on nothing. So the section
 * order is read from the tree the page returns, each section is awaited and
 * rendered itself, and the first test proves the render holds the page's real
 * text before any "does not contain" is believed.
 */
type Component = (props?: object) => Promise<ReactNode> | ReactNode;

const sections = async (): Promise<Component[]> => {
  const tree = (await LandPage()) as ReactElement<{ children: ReactNode }>;
  const main = Children.toArray(tree.props.children).find(
    (c): c is ReactElement<{ children: ReactNode }> => isValidElement(c) && c.type === 'main',
  );
  if (!main) throw new Error('the page no longer renders a <main>');
  return Children.toArray(main.props.children)
    .filter(isValidElement)
    .map((c) => c.type as Component);
};

const renderSections = async () => {
  const rendered = await Promise.all(
    (await sections()).map(async (S) => ({ name: S.name, node: await S() })),
  );
  return render(
    <>
      {rendered.map(({ name, node }) => (
        <Fragment key={name}>{node}</Fragment>
      ))}
    </>,
  );
};

/**
 * The page as a reader sees it: one line per text node. `textContent` glues
 * the nodes together, so a price ending one section ran straight into the next
 * heading ("12 000 €Pourquoi") and escaped the no-parcel pattern.
 */
const pageText = (root: HTMLElement) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const lines: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    lines.push(node.textContent ?? '');
  }
  return lines.join('\n');
};

describe.each([
  ['fr', fr],
  ['en', en],
] as const)('P10 - /products/lands (%s)', (locale, messages) => {
  beforeEach(() => setTestLocale(locale));

  it('renders the page it is checking - a guard against asserting on an empty render', async () => {
    const { container } = await renderSections();
    expect(container.textContent).toContain(messages.landsHero.subtitle);
    expect(container.textContent).toContain(messages.howItWorks.title);
    expect(container.textContent).toContain(messages.whyBuyAtKambriq.title);
  });

  it('lists the seven rubriques of the selection dossier, right after how to buy', async () => {
    const order = (await sections()).map((S) => S.name);
    expect(order.indexOf('SelectionDossier')).toBe(order.indexOf('HowItWorks') + 1);

    await renderSections();
    const dossier = screen.getByTestId('lands-selection-dossier');
    expect(within(dossier).getAllByRole('listitem')).toHaveLength(7);
  });

  it("never names the land file's internal sections, nor the owner's identity document", async () => {
    await renderSections();
    const text = screen.getByTestId('lands-selection-dossier').textContent ?? '';
    expect(text).not.toMatch(
      /d[ée]claration|usage interne|internal use|pi[èe]ce d.identit[ée]|identity (?:card|document)|\bCNI\b/i,
    );
  });

  it('promises no catalogue', async () => {
    const { container } = await renderSections();
    expect(pageText(container)).not.toMatch(/catalogue|catalog/i);
  });

  it('says nothing about what an agent earns', async () => {
    const { container } = await renderSections();
    expect(pageText(container)).not.toMatch(
      /commissions?|r[ée]mun[ée]r|gagn(?:ez|er)|revenus?|\bearn|income|Avantages Agent|Agent advantages/i,
    );
  });

  it('shows no parcel: no price, no area, no parcel reference', async () => {
    const { container } = await renderSections();
    // `€` and `m²` take no `\b`: they are not word characters, so no word
    // boundary follows them, and `500 m²` passed the first version of this test.
    expect(pageText(container)).not.toMatch(
      /\d[\d\s.,]*\s*(?:(?:FCFA|XAF|m2|ha)\b|€|m²)|\bTF\s*n?°?\s*\d|KBQ-/i,
    );
  });
});
