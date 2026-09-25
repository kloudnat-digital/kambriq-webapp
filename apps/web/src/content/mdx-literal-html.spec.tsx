import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MDX_COMPONENTS } from '../../mdx-components';

/**
 * P25 - an element written as literal HTML in MDX is not styled.
 *
 * The price table on `/products/verify` rendered "Vérification externe (terrain
 * trouvé par vous)99 €": no padding, no borders. The report suspected Next was
 * not finding `mdx-components.tsx` at all, on all eight MDX pages. Measured on
 * dev, the mapping IS applied - every heading and paragraph carries its mapped
 * classes. It was the table alone: MDX runs the component map over elements it
 * builds from Markdown, and a lowercase tag written literally, `<table>`, is
 * emitted as it stands.
 *
 * So no MDX file may write a mapped element as a literal lowercase tag. Where
 * Markdown has no syntax for it (a table: GFM is not enabled), the mapping
 * provides a capitalised alias - `<Table>`, `<Th>` - which MDX does resolve
 * through the same map, to the same renderer.
 */
const components = MDX_COMPONENTS as Record<string, unknown>;
const MAPPED = Object.keys(components).filter((k) => /^[a-z]/.test(k));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const MDX = walk(__dirname).filter((f) => f.endsWith('.mdx'));

describe('P25 - MDX content goes through the component map', () => {
  it('reads every MDX file, and the map is the real one', () => {
    expect(MDX.length).toBeGreaterThanOrEqual(16);
    expect(MAPPED).toEqual(expect.arrayContaining(['h2', 'p', 'table', 'th', 'td']));
  });

  it('no MDX file writes a mapped element as a literal tag', () => {
    const literal = new RegExp(`<(${MAPPED.join('|')})[\\s>/]`, 'g');
    const found = MDX.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(literal)].map(
        (m) => `${relative(__dirname, f)}: <${m[1]}>`,
      ),
    );
    expect([...new Set(found)]).toEqual([]);
  });

  it.each(['Table', 'Thead', 'Tbody', 'Tr', 'Th', 'Td'])(
    'offers <%s> as the same renderer as its lowercase element',
    (alias) => {
      expect(components[alias]).toBeDefined();
      expect(components[alias]).toBe(components[alias.toLowerCase()]);
    },
  );
});
