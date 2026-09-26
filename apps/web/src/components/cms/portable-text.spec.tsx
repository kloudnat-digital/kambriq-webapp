import { render, screen } from '@testing-library/react';
import { PortableText } from '@portabletext/react';
import type { TypedObject } from '@portabletext/types';
import { CONTENT_BLOCK_STYLES } from '@kambriq/common/cms/content-page';
import { KBS_LABEL_DEFINITIONS } from '@kambriq/common/kbs/label-definitions';
import { CmsBody, UnrenderableDocumentError, cmsComponents } from './portable-text';

/**
 * The CMS renderer.
 *
 * The assertions that matter are the refusals. `@portabletext/react` defaults
 * `onMissingComponent` to a console warning and then renders the node with a
 * fallback, so a block type added in the Studio and not here would produce a
 * page that looks complete with a section missing - and nothing would report
 * it.
 */

/** An object-type node, as the delivery hands it over: `_type` plus its own fields. */
const objectBlock = (type: string, fields: Record<string, unknown> = {}): TypedObject =>
  ({ _type: type, _key: `k-${type}`, ...fields }) as unknown as TypedObject;

const block = (text: string, style = 'normal', extra: Record<string, unknown> = {}) => ({
  _type: 'block',
  _key: `k-${text.slice(0, 6)}`,
  style,
  markDefs: [],
  children: [{ _type: 'span', _key: 's', text, marks: [] }],
  ...extra,
});

describe('the CMS renderer', () => {
  it('renders headings, paragraphs and list items', () => {
    render(
      <CmsBody
        body={[
          block('A heading', 'h2'),
          block('A paragraph'),
          block('An item', 'normal', { listItem: 'number', level: 1 }),
        ]}
        language="fr"
      />,
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('A heading');
    expect(screen.getByText('A paragraph')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('An item');
  });

  it('renders a divider and a table', () => {
    // Built through the helper rather than inline: `TypedObject` has no `columns`,
    // and an object literal assigned straight into the array is excess-property
    // checked. The runtime value is what the ndjson carries either way.
    const table = objectBlock('table', {
      columns: ['Situation', 'Prix'],
      rows: [{ _type: 'tableRow', _key: 'r', cells: ['Externe', '99 €'] }],
    });

    const { container } = render(<CmsBody body={[objectBlock('divider'), table]} language="fr" />);

    expect(container.querySelector('hr')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Prix' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '99 €' })).toBeInTheDocument();
  });

  it.each(['fr', 'en'] as const)('renders the three labels from the code, in %s', (language) => {
    // The block carries no text of its own: the definitions are pinned to the
    // KBS question bank, and a wording an editor could change here would be
    // the same fact in two places with nothing comparing them.
    render(<CmsBody body={[{ _type: 'labelDefinitions', _key: 'l' }]} language={language} />);

    for (const definition of Object.values(KBS_LABEL_DEFINITIONS)) {
      expect(
        screen.getByRole('heading', {
          name: `KAMBRIQ ${definition.code}™ - ${definition.expansion}`,
        }),
      ).toBeInTheDocument();
    }
    // The emphasis the markdown carried survives: "PAS" and "NOT" are the two
    // words a buyer must not skim.
    const emphasised = language === 'fr' ? 'PAS' : 'NOT';
    expect(screen.getByText(emphasised).tagName).toBe('STRONG');
  });

  describe('it refuses what it cannot reproduce', () => {
    const unknown: TypedObject[] = [{ _type: 'videoEmbed', _key: 'v' }];

    it('throws on a block type it has no component for', () => {
      expect(() => render(<CmsBody body={unknown} language="fr" />)).toThrow(
        UnrenderableDocumentError,
      );
    });

    it('cannot refuse an unknown block STYLE, which is why the Studio bans it', () => {
      /**
       * Measured, and the reason the style list is enforced in the Studio.
       * `mergeComponents` puts the library's own block map under ours, so `h5`
       * resolves to its default heading and `onMissingComponent` is never
       * called. Nothing here can report it - so the editor is not offered it,
       * and `studio-schema-matches-the-contract.spec.ts` pins that list.
       */
      const { container } = render(<CmsBody body={[block('Heading five', 'h5')]} language="fr" />);

      expect(container.querySelector('h5')).toBeInTheDocument();
      // And unstyled, which is the whole cost of the gap.
      expect(container.querySelector('h5')?.className).toBe('');
    });

    it('renders every style the contract offers, and with our classes', () => {
      for (const style of CONTENT_BLOCK_STYLES) {
        const { container } = render(<CmsBody body={[block('Text', style)]} language="fr" />);
        const element = container.firstElementChild;
        expect({ style, styled: Boolean(element?.className) }).toEqual({ style, styled: true });
      }
    });

    it('would otherwise have rendered a fallback instead of failing', () => {
      /**
       * The measurement behind the throw, not a claim about a default nobody
       * checked. With the library's own handling, the same document renders
       * without an error and without the content.
       */
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const { container } = render(
        <PortableText<TypedObject> value={unknown} components={cmsComponents('fr')} />,
      );

      expect(warn).toHaveBeenCalled();
      expect(container.textContent).toContain('Unknown block type');

      warn.mockRestore();
    });
  });
});
