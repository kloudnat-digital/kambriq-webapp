import { renderPolicyHtml, UnrenderablePolicyError } from '../../cms/policy-render';

const block = (text: string, style = 'normal', key = 'b1') => ({
  _type: 'block',
  _key: key,
  style,
  children: [{ _type: 'span', _key: `${key}s`, text, marks: [] }],
});

describe('rendering a policy for the archive', () => {
  it('renders headings, paragraphs and marks', () => {
    const html = renderPolicyHtml([
      block('Politique de confidentialite', 'h1'),
      {
        _type: 'block',
        _key: 'b2',
        style: 'normal',
        markDefs: [],
        children: [
          { _type: 'span', _key: 's1', text: 'Nous conservons ', marks: [] },
          { _type: 'span', _key: 's2', text: 'vos donnees', marks: ['strong'] },
          { _type: 'span', _key: 's3', text: ' douze mois.', marks: [] },
        ],
      },
    ]);

    expect(html).toBe(
      '<h1>Politique de confidentialite</h1>' +
        '<p>Nous conservons <strong>vos donnees</strong> douze mois.</p>',
    );
  });

  it('escapes text, so stored HTML is safe to serve', () => {
    const html = renderPolicyHtml([block('<script>alert(1)</script>')]);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops a javascript: link target but keeps the words', () => {
    const html = renderPolicyHtml([
      {
        _type: 'block',
        _key: 'b1',
        style: 'normal',
        markDefs: [{ _type: 'link', _key: 'l1', href: 'javascript:alert(1)' }],
        children: [{ _type: 'span', _key: 's1', text: 'Cliquez ici', marks: ['l1'] }],
      },
    ]);

    expect(html).not.toContain('javascript:');
    expect(html).toContain('Cliquez ici');
  });

  describe('refusing what it cannot reproduce', () => {
    /**
     * The library's defaults do not fail on an unknown node. An unknown type
     * renders as a hidden `<div>` and an unknown block style flattens to `<p>`,
     * both of which produce HTML that looks complete and is not. For an archive
     * of what somebody agreed to, that is the failure worth refusing.
     */
    it('throws on a block type it has no renderer for', () => {
      expect(() => renderPolicyHtml([{ _type: 'pricingTable', _key: 'x1', rows: [] }])).toThrow(
        UnrenderablePolicyError,
      );
    });

    it('names the node in the error, so the missing renderer is findable', () => {
      expect(() => renderPolicyHtml([{ _type: 'pricingTable', _key: 'x1' }])).toThrow(
        /pricingTable/,
      );
    });

    it('throws on a block style it has no renderer for', () => {
      expect(() => renderPolicyHtml([block('Un aparte', 'legalNote')])).toThrow(
        UnrenderablePolicyError,
      );
    });

    it('throws on a mark it has no renderer for', () => {
      expect(() =>
        renderPolicyHtml([
          {
            _type: 'block',
            _key: 'b1',
            style: 'normal',
            markDefs: [],
            children: [{ _type: 'span', _key: 's1', text: 'important', marks: ['highlight'] }],
          },
        ]),
      ).toThrow(UnrenderablePolicyError);
    });

    it('would otherwise have hidden the content instead of failing', () => {
      // The behaviour the throw replaces, asserted against the library so this
      // stops being a claim about a default nobody checked.
      const { toHTML } =
        jest.requireActual<typeof import('@portabletext/to-html')>('@portabletext/to-html');
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const html = toHTML([{ _type: 'pricingTable', _key: 'x1' }]);

      expect(html).toContain('display:none');
      warn.mockRestore();
    });
  });
});
