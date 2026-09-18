jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
// `nuqs` ships ESM and Jest cannot parse it, the same wall next-intl hit. See
// `nuqs-mock.tsx`: the state it holds is real, so a filter that does nothing
// cannot pass its own test.
jest.mock('nuqs', () => require('@/test-utils/nuqs-mock'));
jest.mock('@/lib/actions/kamnet', () => ({
  getMyLeads: jest.fn(),
  createLead: jest.fn(),
  updateLead: jest.fn(),
  deleteLead: jest.fn(),
}));

import { render, screen } from '@testing-library/react';

import { getMyLeads } from '@/lib/actions/kamnet';
import { resetTestQueryState } from '@/test-utils/nuqs-mock';
import ProspectsPage from './page';

const leads = getMyLeads as jest.MockedFunction<typeof getMyLeads>;

// URL state is module-level, so it must be cleared between tests: a status set
// in one test leaking into the next makes the second pass for the wrong reason.
beforeEach(() => resetTestQueryState());

/**
 * `/agent/prospects` - the screen that makes prospection possible.
 *
 * Section 9 of the base comprehension document calls step 3 "le premier moment
 * ou l'engagement est tenu a moitie": the first point at which an agent can
 * actually record and follow a prospect. So the tests here are about a real
 * agent's path, not about rendering.
 *
 * What it replaces is a 25-line `PlaceholderPage` listing four features it did
 * not have. Unlike `/agent/network` there were no invented rows to delete -
 * this screen was honest about being empty, which is why the negative
 * assertions here are about the empty state rather than about fabricated names.
 */

const lead = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'l1',
  agentId: 'a1',
  clientName: 'Alphonse Bello',
  clientEmail: 'alphonse.bello@example.test',
  clientPhone: '+237600000001',
  source: 'REFERRAL',
  notes: 'Interesse par une parcelle a Douala',
  status: 'QUALIFIED',
  convertedAt: null,
  createdAt: '2026-02-15T00:00:00.000Z',
  updatedAt: '2026-02-15T00:00:00.000Z',
  ...over,
});

const answers = (rows: unknown[], meta?: Partial<Record<string, number>>) =>
  leads.mockResolvedValue({
    success: true,
    data: {
      data: rows,
      meta: { total: rows.length, totalPages: 1, page: 1, limit: 20, ...meta },
    },
  } as Awaited<ReturnType<typeof getMyLeads>>);

const renderPage = async (searchParams: Record<string, string> = {}) =>
  render(await ProspectsPage({ searchParams: Promise.resolve(searchParams) }));

describe('/agent/prospects - the list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the prospects the API returned', async () => {
    answers([lead(), lead({ id: 'l2', clientName: 'Fatou Diallo', status: 'CONTACTED' })]);

    await renderPage();

    expect(screen.getByText('Alphonse Bello')).toBeInTheDocument();
    expect(screen.getByText('Fatou Diallo')).toBeInTheDocument();
  });

  it('tells an agent with no prospects that they have none, rather than showing an empty table', async () => {
    answers([]);

    const { container } = await renderPage();

    expect(container.querySelector('[data-prospects="empty"]')).toBeInTheDocument();
    expect(container.querySelector('[data-prospects="table"]')).not.toBeInTheDocument();
  });

  it('shows the table as soon as there is one prospect', async () => {
    answers([lead()]);

    const { container } = await renderPage();

    expect(container.querySelector('[data-prospects="table"]')).toBeInTheDocument();
    expect(container.querySelector('[data-prospects="empty"]')).not.toBeInTheDocument();
  });

  it('shows the empty state when the action reports a failure, and invents no rows', async () => {
    leads.mockResolvedValue({ success: false, error: 'nope', status: 500 });

    const { container } = await renderPage();

    expect(container.querySelector('[data-prospects="empty"]')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Alphonse Bello');
  });
});

describe('/agent/prospects - filter and search reach the API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the status filter through to the action', async () => {
    answers([]);

    await renderPage({ status: 'CONTACTED' });

    expect(leads).toHaveBeenCalledWith(expect.objectContaining({ status: 'CONTACTED' }));
  });

  it('passes the search term through to the action', async () => {
    answers([]);

    await renderPage({ search: 'Fatou' });

    expect(leads).toHaveBeenCalledWith(expect.objectContaining({ search: 'Fatou' }));
  });

  it('sends no status when the filter is the ALL sentinel', async () => {
    /**
     * Radix `Select` forbids `value=""`, so "every status" needs a sentinel
     * rather than an empty option. The precedent this screen follows,
     * `candidates-list-content.tsx`, has no all-statuses option at all - once a
     * status is picked the filter cannot be cleared. That is a defect, not a
     * pattern, so the sentinel is mapped to NO status parameter here.
     */
    answers([]);

    await renderPage({ status: 'ALL' });

    const passed = leads.mock.calls[0][0] as Record<string, unknown> | undefined;
    expect(passed?.status).toBeUndefined();
  });

  it('asks for page 1 by default and for the page it was given', async () => {
    answers([]);
    await renderPage();
    expect(leads).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));

    jest.clearAllMocks();
    answers([]);
    await renderPage({ page: '3' });
    expect(leads).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
  });
});

describe('/agent/prospects - the status a prospect is at', () => {
  beforeEach(() => jest.clearAllMocks());

  it('labels each of the five statuses from the catalogue, never from the code', async () => {
    // `'QUALIFIED'.toLowerCase()` is not "Qualifie". The labels live in i18n,
    // keyed by the enum value, exactly as `app.kbs.status` does.
    answers([
      lead({ id: 'a', status: 'NEW', clientName: 'A A' }),
      lead({ id: 'b', status: 'CONTACTED', clientName: 'B B' }),
      lead({ id: 'c', status: 'QUALIFIED', clientName: 'C C' }),
      lead({ id: 'd', status: 'CONVERTED', clientName: 'D D' }),
      lead({ id: 'e', status: 'LOST', clientName: 'E E' }),
    ]);

    const { container } = await renderPage();

    const pills = container.querySelectorAll('[data-lead-status]');
    expect(Array.from(pills).map((p) => p.getAttribute('data-lead-status'))).toEqual([
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'CONVERTED',
      'LOST',
    ]);
    for (const pill of Array.from(pills)) {
      expect(pill.textContent?.trim()).not.toBe('');
    }
  });

  it('renders a status it does not recognise without crashing and without a blank pill', async () => {
    /**
     * The equivalent of a quiz row with no correct answer: a value outside the
     * five. `KAMNET_VALID_LEAD_TRANSITIONS[unknown]` is undefined, so the row
     * must offer no moves rather than offer all of them, and the pill must say
     * something rather than render empty.
     */
    answers([lead({ status: 'WOBBLE' })]);

    const { container } = await renderPage();

    const pill = container.querySelector('[data-lead-status="WOBBLE"]');
    expect(pill).toBeInTheDocument();
    expect(pill?.textContent?.trim()).not.toBe('');
    expect(container.querySelectorAll('[data-lead-transition]')).toHaveLength(0);
  });
});

describe('/agent/prospects - only legal moves are offered', () => {
  beforeEach(() => jest.clearAllMocks());

  const offered = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-lead-transition]'))
      .map((n) => n.getAttribute('data-lead-transition'))
      .sort();

  it.each([
    ['NEW', ['CONTACTED', 'LOST']],
    ['CONTACTED', ['LOST', 'QUALIFIED']],
    ['QUALIFIED', ['CONVERTED', 'LOST']],
    ['LOST', ['CONTACTED']],
  ])('a %s prospect is offered exactly %j', async (status, expected) => {
    answers([lead({ status })]);

    const { container } = await renderPage();

    expect(offered(container)).toEqual(expected);
  });

  it('a CONVERTED prospect is offered no move at all, because the table is empty there', async () => {
    answers([lead({ status: 'CONVERTED' })]);

    const { container } = await renderPage();

    expect(offered(container)).toEqual([]);
  });

  it('never offers a move the API would refuse', async () => {
    // The whole point: the screen is constrained by the same table the service
    // enforces, so a legal-looking button cannot produce a 400.
    const legal: Record<string, string[]> = {
      NEW: ['CONTACTED', 'LOST'],
      CONTACTED: ['QUALIFIED', 'LOST'],
      QUALIFIED: ['CONVERTED', 'LOST'],
      CONVERTED: [],
      LOST: ['CONTACTED'],
    };

    for (const [status, allowed] of Object.entries(legal)) {
      jest.clearAllMocks();
      answers([lead({ status })]);
      const { container } = await renderPage();

      for (const move of offered(container)) {
        expect(allowed).toContain(move);
      }
    }
  });
});

describe('/agent/prospects - edit and delete are reachable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers an edit control for every prospect, including a CONVERTED one', async () => {
    // A converted prospect's notes are still editable. Under the API defect
    // this PR fixes, they were frozen by a rule about status.
    answers([lead({ id: 'l1', status: 'QUALIFIED' }), lead({ id: 'l2', status: 'CONVERTED' })]);

    const { container } = await renderPage();

    expect(container.querySelectorAll('[data-lead-edit]')).toHaveLength(2);
  });

  it('offers a delete control for every prospect', async () => {
    answers([lead({ id: 'l1' }), lead({ id: 'l2', clientName: 'Fatou Diallo' })]);

    const { container } = await renderPage();

    expect(container.querySelectorAll('[data-lead-delete]')).toHaveLength(2);
  });

  it('offers a way to create a prospect even when the list is empty', async () => {
    answers([]);

    const { container } = await renderPage();

    expect(container.querySelector('[data-lead-create]')).toBeInTheDocument();
  });
});

describe('/agent/prospects - the placeholder is gone', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no longer renders PlaceholderPage or its invented feature list', async () => {
    answers([lead()]);

    const { container } = await renderPage();

    expect(container).not.toHaveTextContent(/Liste des prospects avec statut/);
    expect(container).not.toHaveTextContent(/Historique des interactions/);
  });

  it('imports no PlaceholderPage in the page module', async () => {
    // Structural, with comments stripped: this repository has flagged its own
    // prose four times now for naming the thing a sweep bans.
    const raw = require('node:fs').readFileSync(__dirname + '/page.tsx', 'utf8') as string;
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(src).not.toMatch(/PlaceholderPage/);
  });
});
