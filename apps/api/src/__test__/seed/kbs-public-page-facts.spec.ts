/* eslint-disable @nx/enforce-module-boundaries -- the generated course lives in prisma/seed-data, outside any nx project; this test exists to pin the public page against it */
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_EXAM_QUESTION_COUNT, EXAM_PASSING_SCORE } from '@kambriq/common/constants/kbs';
import { KCA1_PRICE_EUR, KCA1_PRICE_XAF_DISPLAY } from '@kambriq/common/constants/kbs/pricing';
import { KCA1_PARCOURS } from '../../../../../prisma/seed-data/kca1';

/**
 * P19 - the public KBS page must describe the programme that is actually served.
 *
 * ---------------------------------------------------------------------------
 * Why the page does not read these numbers at runtime
 * ---------------------------------------------------------------------------
 * It cannot, and the reason is worth writing down rather than discovering
 * again. `/products/kbs` is a public marketing page; the course structure lives
 * behind `GET /kbs/courses` and `GET /kbs/me/overview`, both of which require
 * an authenticated candidate. There is no public endpoint exposing the active
 * course, and inventing one to feed a marketing page would put the syllabus on
 * an anonymous route for a copy deadline - a product decision, not a rendering
 * convenience.
 *
 * So the figures stay in the i18n files, where the rest of the page's words
 * are, and THIS test is the mechanism that keeps them true: it fails the day
 * the seeded course stops matching the page. That is the arrangement the brief
 * asked for when reading live turned out to be impossible.
 *
 * ---------------------------------------------------------------------------
 * What it pins, and against what
 * ---------------------------------------------------------------------------
 * - the module and lesson counts, against `KCA1_PARCOURS` - the same generated
 *   module the loader writes and the platform serves;
 * - the exam length and threshold, against `DEFAULT_EXAM_QUESTION_COUNT` and
 *   `EXAM_PASSING_SCORE` - the constants `scheduleExam` and `gradeExam` use;
 * - the fee, against `pricing.ts`, in both currencies;
 * - the absence of a global duration, which decision 4 of 18 September removed:
 *   per-module durations only, because the summary table's "2h a 2h30" is false
 *   against the 33 markers.
 *
 * It reads the web's message files directly, the way
 * `kbs-label-definitions.spec.ts` reads `apps/web/src/content/methode/fr.mdx`.
 * Either side changing without the other fails this, which is the point:
 * somebody has to re-read both rather than let them drift.
 */
const messagesPath = (locale: string) =>
  path.resolve(__dirname, '../../../../../apps/web/src/i18n/messages', `${locale}.json`);

const load = (locale: string) =>
  JSON.parse(fs.readFileSync(messagesPath(locale), 'utf8')) as {
    products: { kbs: Record<string, unknown> };
    faq?: { items?: Array<{ q: string; a: string }> };
  };

const LOCALES = ['fr', 'en'] as const;

/** Every string under `products.kbs`, flattened, so no claim hides in an array. */
const allText = (node: unknown): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(allText).join(' ');
  if (node && typeof node === 'object') return Object.values(node).map(allText).join(' ');
  return '';
};

const REAL_MODULES = KCA1_PARCOURS.length;
const REAL_LESSONS = KCA1_PARCOURS.reduce((n, p) => n + p.lessons.length, 0);

describe('the public KBS page describes the programme that is served', () => {
  /** The fixture itself, so the assertions below cannot be vacuous. */
  it('is reading a real course and a real page', () => {
    expect(REAL_MODULES).toBe(4);
    expect(REAL_LESSONS).toBe(33);
    expect(allText(load('fr').products.kbs).length).toBeGreaterThan(200);
  });

  it.each(LOCALES)('%s states the real module and lesson counts', (locale) => {
    const text = allText(load(locale).products.kbs);

    expect(text).toContain(String(REAL_MODULES));
    expect(text).toContain(String(REAL_LESSONS));
  });

  /**
   * The counts that were there instead. Banned by value rather than by phrase,
   * because "6 modules" and "six modules complets" are the same false claim.
   */
  it.each(LOCALES)('%s no longer claims six modules or thirty-two lessons', (locale) => {
    const text = allText(load(locale).products.kbs);

    expect(text).not.toMatch(/\b6 modules\b|\bsix modules\b/i);
    expect(text).not.toMatch(/\b32 (lessons|le[cç]ons)\b/i);
  });

  it.each(LOCALES)('%s states the real exam length and threshold', (locale) => {
    const text = allText(load(locale).products.kbs);

    expect(text).toContain(String(DEFAULT_EXAM_QUESTION_COUNT));
    expect(text).toContain(String(EXAM_PASSING_SCORE));
  });

  it.each(LOCALES)('%s no longer claims thirty questions or eighty-five per cent', (locale) => {
    const text = allText(load(locale).products.kbs);

    expect(text).not.toMatch(/\b30[- ]?(question|minutes)/i);
    expect(text).not.toMatch(/\b85\s?%/);
  });

  /** Decision 4 of 18 September: per-module durations, never a global total. */
  it.each(LOCALES)('%s announces no global course duration', (locale) => {
    const text = allText(load(locale).products.kbs);

    expect(text).not.toMatch(/\b8 semaines\b|\b8[- ]weeks?\b/i);
    expect(text).not.toMatch(/\b2 mois\b|\b2[- ]months?\b/i);
    expect(text).not.toMatch(/dur[ée]e totale|total duration/i);
  });

  it.each(LOCALES)('%s carries the fee in both currencies, from one source', (locale) => {
    const text = allText(load(locale).products.kbs);

    expect(text).toContain(String(KCA1_PRICE_EUR));
    expect(text).toContain(KCA1_PRICE_XAF_DISPLAY);
  });

  /**
   * The same false threshold also lives outside this page, in the FAQ. A page
   * corrected while the FAQ keeps saying 85 per cent is two spellings again.
   */
  it.each(LOCALES)('%s does not contradict the threshold in the FAQ', (locale) => {
    const faq = load(locale).faq?.items ?? [];
    const text = faq.map((i) => `${i.q} ${i.a}`).join(' ');

    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/\b85\s?%/);
  });
});
