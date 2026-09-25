import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * I43 - copy a person reads goes through the translations.
 *
 * Ten signed-in screens rendered `PlaceholderPage` with a `features` list: 38
 * things "to come", written in French inside the components. An agent reading
 * in English read French promises, and P21's guard could see none of them,
 * because it reads the translation catalogues and these never entered one.
 *
 * This is P21's sibling, not a widening of it. It reads every `.tsx` file under
 * `apps/web/src` - a new file is covered the day it is added - and finds prose
 * written straight into JSX: a text node, a string given to a prop, or strings
 * in an array or a conditional handed to JSX. A file may hold such prose only
 * if it is declared below, with its reason.
 *
 * **What it does not see, stated:** a string stored in a constant and passed to
 * JSX by name. That is a limit of reading syntax, and the reason the promise
 * shape itself is also pinned by the placeholder render test.
 */
const WEB_SRC = join(__dirname, '..');

/**
 * Hardcoded copy that existed when this guard was written, file by file. Each
 * is debt, not permission: it reads in French to an English speaker. An entry
 * is removed when its file goes through the translations, and an entry whose
 * file no longer holds prose fails the last test below.
 */
const HARDCODED_COPY_DEBT: Record<string, string> = {
  'app/[locale]/(app)/admin/identities/[id]/page.tsx': 'identity review (A10/G4), French only',
  'app/[locale]/(app)/admin/verify/page.tsx': 'VERIFY back office, French only',
  'app/[locale]/(app)/invite/page.tsx': 'client portal invitation, French only',
  'app/[locale]/kamnet/apply/page.tsx': 'KAMNET application form, French only',
  'app/[locale]/verify-certificate/[certificateNumber]/page.tsx':
    'public certificate verdict, French only',
  'app/global-error.tsx': 'last-resort error page, rendered outside the i18n provider',
  'components/auth/auth-shell.tsx': 'home link label of the sign-in screens, French only',
  'components/dashboard/admin-verify/verify-requests-table.tsx': 'VERIFY back office, French only',
  'components/identities/identity-queue-content.tsx': 'identity queue (A10), French only',
  'components/identities/identity-review-action.tsx': 'identity review (A10), French only',
  'components/invite/invite-form.tsx': 'client portal invitation, French only',
  'components/kamnet/agents-management-content.tsx': 'KAMNET back office, French only',
  'components/kbs-admin/candidate-detail-content.tsx': 'KBS back office, English only',
  'components/kbs-admin/exams-list-content.tsx': 'KBS back office, English only',
  'components/kbs/kbs-certificate-view.tsx': 'the certificate names the school in its own words',
  'components/kbs/kbs-enroll-form.tsx': 'KBS enrolment notice, French only',
  'components/mylands/journey-steps.tsx': 'client purchase tracking, French only',
  'components/mylands/my-payment-content.tsx': 'client payment screen (G9), French only',
  'components/mylands/purchase-documents.tsx': 'client purchase tracking, French only',
  'components/mylands/request-payment-card.tsx': 'client payment request (G9), French only',
  'components/payments-admin/advance-payment-action.tsx': 'payments back office (G4), French only',
  'components/payments-admin/payment-detail-content.tsx': 'payments back office (G4), French only',
  'components/payments-admin/proof-link.tsx': 'payments back office (G4), French only',
  'components/payments-admin/payments-list-content.tsx': 'payments back office (G4), French only',
  'components/payments-admin/record-receipt-form.tsx': 'payments back office (G4), French only',
  'components/payments-admin/request-queue-content.tsx': 'payments back office (G4), French only',
  'components/payments-admin/send-instructions-action.tsx':
    'payments back office (G4), French only',
  'components/payments-admin/validate-payment-action.tsx': 'payments back office (G4), French only',
  'components/ui/kambriq-logo.tsx': 'the logo alt text, the brand name in both languages',
  'components/ui/pagination.tsx': 'screen-reader label of the shared pagination, English only',
};

/** Props whose string value is never read by a person. */
const NOT_COPY_PROP =
  /^(?:className|\w+ClassName|href|src|sizes|id|key|data-[\w-]+|type|variant|size|name|rel|target|method|autoComplete|inputMode|role|htmlFor|as|lang|dir|fill|stroke|viewBox|d|xmlns)$/;

/** Two words of letters: prose, not a code, a unit or a single label token. */
const PROSE = /\p{L}{2,}[^\p{L}\d]*[\s'’][^\p{L}\d]*\p{L}{2,}/u;

/** Nodes a string passes through on its way into JSX without changing meaning. */
const PASS_THROUGH = (n: ts.Node) =>
  ts.isParenthesizedExpression(n) ||
  ts.isConditionalExpression(n) ||
  ts.isArrayLiteralExpression(n) ||
  (ts.isBinaryExpression(n) &&
    [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(n.operatorToken.kind));

export const hardcodedCopy = (fileName: string, source: string): string[] => {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const reachesJsx = (node: ts.Node): boolean => {
    let p = node.parent;
    while (p && PASS_THROUGH(p)) p = p.parent;
    if (!p) return false;
    if (ts.isJsxAttribute(p)) return !NOT_COPY_PROP.test(p.name.getText(sf));
    if (ts.isJsxExpression(p)) {
      const holder = p.parent;
      return !(holder && ts.isJsxAttribute(holder) && NOT_COPY_PROP.test(holder.name.getText(sf)));
    }
    return false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      if (PROSE.test(text)) found.push(text);
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      PROSE.test(node.text) &&
      reachesJsx(node)
    ) {
      found.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
};

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const COMPONENTS = walk(WEB_SRC)
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.spec.tsx'))
  .map((f) => relative(WEB_SRC, f));

const offenders = () =>
  COMPONENTS.map(
    (f) => [f, hardcodedCopy(f, readFileSync(join(WEB_SRC, f), 'utf8'))] as const,
  ).filter(([, found]) => found.length > 0);

describe('I43 - copy a person reads goes through the translations', () => {
  it('finds prose written into JSX in every shape it takes', () => {
    const source = `
      const A = () => <p className="text-sm text-gray-500">Export des relevés</p>;
      const B = () => <Page features={['Tableau des commissions', "Catégories (litige, fraude)"]} />;
      const C = ({ ok }) => <span title={ok ? 'Tout est prêt' : 'Pas encore'}>{ok && 'Suivi du traitement'}</span>;
      const D = () => <a href="/agent/commissions" className="p-6 lg:p-8" data-testid="x y">{t('pageTitle')}</a>;
    `;
    expect(hardcodedCopy('sample.tsx', source)).toEqual([
      'Export des relevés',
      'Tableau des commissions',
      'Catégories (litige, fraude)',
      'Tout est prêt',
      'Pas encore',
      'Suivi du traitement',
    ]);
  });

  it('reads the whole web app, not a list', () => {
    expect(COMPONENTS.length).toBeGreaterThan(200);
    expect(COMPONENTS).toContain('components/placeholder-page.tsx');
  });

  it('no undeclared file writes copy straight into JSX', () => {
    const undeclared = offenders()
      .filter(([f]) => !(f in HARDCODED_COPY_DEBT))
      .map(([f, found]) => `${f}: ${found.join(' | ')}`);
    expect(undeclared).toEqual([]);
  });

  it('every declared debt still exists - a paid debt leaves the list', () => {
    const owing = new Set(offenders().map(([f]) => f));
    expect(Object.keys(HARDCODED_COPY_DEBT).filter((f) => !owing.has(f))).toEqual([]);
  });
});
