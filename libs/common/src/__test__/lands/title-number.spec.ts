import {
  KNOWN_DEPARTMENT_CODES,
  isUnlistedDepartment,
  parseTitleNumber,
} from '../../lands/title-number';

/**
 * P24 - the list of known departments may one day WARN. It never refuses, and
 * while it is empty it says nothing at all.
 */
describe('P24 - known departments drive a warning, never the decision', () => {
  const title = (raw: string) => {
    const parsed = parseTitleNumber(raw);
    if (!parsed) throw new Error(`${raw} should parse`);
    return parsed;
  };

  it('holds no department nobody has confirmed', () => {
    expect(KNOWN_DEPARTMENT_CODES.size).toBe(0);
  });

  it('warns about nothing while the list is empty', () => {
    expect(isUnlistedDepartment(title('TF 77/XQZ'))).toBe(false);
  });

  it('warns about an unlisted department once a list exists, and not about a listed one', () => {
    const known = new Set(['M', 'SM', 'WB']);
    expect(isUnlistedDepartment(title('TF 77/XQZ'), known)).toBe(true);
    expect(isUnlistedDepartment(title('TF 4129/M'), known)).toBe(false);
  });

  it('a title with an unlisted department still parses - the list is not the rule', () => {
    expect(parseTitleNumber('TF 77/XQZ')?.canonical).toBe('TF 77/XQZ');
  });

  it('accepts one to six digits, and not seven', () => {
    expect(parseTitleNumber('TF 7/M')).not.toBeNull();
    expect(parseTitleNumber('TF 123456/M')).not.toBeNull();
    expect(parseTitleNumber('TF 1234567/M')).toBeNull();
  });

  it('accepts one to three department letters, and not four', () => {
    expect(parseTitleNumber('TF 4129/WBX')).not.toBeNull();
    expect(parseTitleNumber('TF 4129/WBXY')).toBeNull();
  });
});
