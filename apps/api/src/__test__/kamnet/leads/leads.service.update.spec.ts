import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { KamnetLeadSource, KamnetLeadStatus } from '@kambriq/common';
import { KamnetLeadsService } from '../../../kamnet/leads/leads.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { mockI18n } from '../../utils';

/**
 * I33 - `update` writes the fields it was given, whether or not the status moved.
 *
 * ---------------------------------------------------------------------------
 * The defect
 * ---------------------------------------------------------------------------
 * The entire write block was nested inside the status-change test:
 *
 *   async update(leadId, agentId, dto) {
 *     const lead = await this.findByIdAndOwner(leadId, agentId);
 *     if (dto.status && dto.status !== lead.status) {
 *       ...validate the transition, then prisma.update(...), return updated;
 *     }
 *   }                                  // no else, no return
 *
 * So a PATCH carrying only `notes`, `clientPhone`, `clientEmail`, `clientName`
 * or `source` performed no write at all, threw nothing, returned `undefined`,
 * and the caller received a success. A PATCH that also carried a legal status
 * change wrote every field correctly - which made the defect INTERMITTENT, and
 * therefore worse than one that always fails: the same screen, the same button,
 * works or does not depending on whether the agent happened to move the status
 * in the same action.
 *
 * Same family as the first entry in this repository's defect catalogue -
 * mechanisms that report success by saying nothing - and the same family as
 * I21, where a scoring path silently graded against the wrong denominator.
 *
 * ---------------------------------------------------------------------------
 * Why there was no test before this file
 * ---------------------------------------------------------------------------
 * There was none. Measured on `develop` at `1cbde1a`: `leads.service` is
 * referenced by zero test files, and no journey called `kamnet/leads`. The
 * endpoint shipped, was wired to a screen in step 3, and nothing had ever
 * executed its update path.
 *
 * ---------------------------------------------------------------------------
 * `convertedAt`, and a behaviour preserved with a new mechanism
 * ---------------------------------------------------------------------------
 * Today, a PATCH carrying `status: CONVERTED` against a lead that is ALREADY
 * `CONVERTED` takes the `dto.status !== lead.status` test as false, so nothing
 * happens: no write, no re-stamp, `undefined` returned. "Not re-stamped" is
 * therefore a CONSEQUENCE OF THE DEFECT, not a guard anybody wrote.
 *
 * Lifting the write out of the condition would start re-stamping it, because
 * the stamp was spread on `dto.status === CONVERTED` alone. So the fix
 * conditions it on an actual transition - `dto.status === CONVERTED &&
 * lead.status !== CONVERTED` - which keeps the observable outcome and replaces
 * the mechanism. The date a lead converted is a fact about when it happened; a
 * later edit is not a second conversion.
 */
describe('KamnetLeadsService.update (I33)', () => {
  const AGENT = 'agent-1';
  const OTHER_AGENT = 'agent-2';
  const LEAD = 'lead-1';

  /**
   * The seeded row every test starts from.
   *
   * The field types are ANNOTATED rather than inferred. Left as a bare literal,
   * TypeScript narrows `status` to `"QUALIFIED"` and `source` to `"REFERRAL"`,
   * and `Partial<typeof base>` then refuses every `existing({ status: ... })`
   * that names another member - which is how the first run of this file failed
   * to compile in five places rather than failing on the defect.
   */
  const base: {
    id: string;
    agentId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    source: KamnetLeadSource;
    notes: string;
    status: KamnetLeadStatus;
    convertedAt: Date | null;
    deletedAt: Date | null;
    deletedBy: string | null;
  } = {
    id: LEAD,
    agentId: AGENT,
    clientName: 'Alphonse Bello',
    clientEmail: 'alphonse.bello@example.test',
    clientPhone: '+237600000001',
    source: KamnetLeadSource.REFERRAL,
    notes: 'Interesse par une parcelle a Douala',
    status: KamnetLeadStatus.QUALIFIED,
    convertedAt: null,
    deletedAt: null,
    deletedBy: null,
  };

  let service: KamnetLeadsService;
  let prisma: { kamnetLead: { findUnique: jest.Mock; update: jest.Mock } };

  /** The row `findByIdAndOwner` will resolve for the next call. */
  const existing = (over: Partial<typeof base> = {}) =>
    prisma.kamnetLead.findUnique.mockResolvedValue({ ...base, ...over });

  /** The `data` object handed to prisma on the single write of this test. */
  const writtenData = () => prisma.kamnetLead.update.mock.calls[0][0].data;

  beforeEach(async () => {
    prisma = {
      kamnetLead: {
        findUnique: jest.fn().mockResolvedValue({ ...base }),
        // Echo the patch back, the way Prisma returns the updated row.
        update: jest.fn().mockImplementation(({ data }) => ({ ...base, ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetLeadsService,
        { provide: KamnetPrismaService, useValue: prisma },
        { provide: I18nService, useValue: mockI18n() },
      ],
    }).compile();

    service = module.get(KamnetLeadsService);
  });

  // ---------------------------------------------------------------------------
  // THE DEFECT: an edit without a status change must be written
  // ---------------------------------------------------------------------------

  it('writes a notes-only edit', async () => {
    const result = await service.update(LEAD, AGENT, { notes: 'Rappeler lundi' });

    expect(prisma.kamnetLead.update).toHaveBeenCalledTimes(1);
    expect(writtenData()).toEqual(expect.objectContaining({ notes: 'Rappeler lundi' }));
    expect(result).toEqual(expect.objectContaining({ notes: 'Rappeler lundi' }));
  });

  it('writes a clientPhone-only edit', async () => {
    const result = await service.update(LEAD, AGENT, { clientPhone: '+237699999999' });

    expect(prisma.kamnetLead.update).toHaveBeenCalledTimes(1);
    expect(writtenData()).toEqual(expect.objectContaining({ clientPhone: '+237699999999' }));
    expect(result).toEqual(expect.objectContaining({ clientPhone: '+237699999999' }));
  });

  it('returns the updated lead, never undefined, when the dto carries no status at all', async () => {
    // The shape of the bug as a caller saw it: a resolved promise carrying
    // nothing, which a controller answers 200 to.
    const result = await service.update(LEAD, AGENT, { clientName: 'Alphonse Bello-Ndoumbe' });

    expect(result).toBeDefined();
    expect(result).not.toBeUndefined();
    expect(result).toEqual(expect.objectContaining({ clientName: 'Alphonse Bello-Ndoumbe' }));
  });

  it('writes every editable field, one at a time, and never resolves undefined', async () => {
    // The property rather than five cases: any accepted edit reaches the row.
    const patches: Array<Record<string, unknown>> = [
      { clientName: 'Nom Modifie' },
      { clientEmail: 'nouveau@example.test' },
      { clientPhone: '+237611111111' },
      { source: KamnetLeadSource.EVENT },
      { notes: 'Note modifiee' },
    ];

    for (const patch of patches) {
      prisma.kamnetLead.update.mockClear();
      existing();

      const result = await service.update(LEAD, AGENT, patch);

      expect(prisma.kamnetLead.update).toHaveBeenCalledTimes(1);
      expect(writtenData()).toEqual(expect.objectContaining(patch));
      expect(result).toBeDefined();
    }
  });

  it('writes an edit that repeats the status the lead already has', async () => {
    // A form that posts every field sends the status unchanged. That is not a
    // transition, and it must not silence the write.
    const result = await service.update(LEAD, AGENT, {
      notes: 'Note mise a jour',
      status: KamnetLeadStatus.QUALIFIED,
    });

    expect(prisma.kamnetLead.update).toHaveBeenCalledTimes(1);
    expect(writtenData()).toEqual(expect.objectContaining({ notes: 'Note mise a jour' }));
    expect(result).toBeDefined();
  });

  it('writes contact edits on a CONVERTED lead, whose transition list is empty', async () => {
    // Under the defect a converted lead could never be edited at all: its notes
    // were frozen by a rule about its status.
    existing({ status: KamnetLeadStatus.CONVERTED, convertedAt: new Date('2026-01-01') });

    const result = await service.update(LEAD, AGENT, { clientPhone: '+237600000009' });

    expect(prisma.kamnetLead.update).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ clientPhone: '+237600000009' }));
  });

  // ---------------------------------------------------------------------------
  // WHAT MUST NOT CHANGE: the transition guard
  // ---------------------------------------------------------------------------

  it('still refuses an illegal transition, with the same exception and the same i18n key', async () => {
    // `mockI18n` returns the key, so this asserts the key rather than a sentence.
    existing({ status: KamnetLeadStatus.QUALIFIED });

    await expect(service.update(LEAD, AGENT, { status: KamnetLeadStatus.NEW })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(LEAD, AGENT, { status: KamnetLeadStatus.NEW })).rejects.toThrow(
      'kamnet.lead.invalidTransition',
    );

    expect(prisma.kamnetLead.update).not.toHaveBeenCalled();
  });

  it('refuses every illegal transition out of every state, and writes nothing', async () => {
    const legal: Record<string, string[]> = {
      NEW: ['CONTACTED', 'LOST'],
      CONTACTED: ['QUALIFIED', 'LOST'],
      QUALIFIED: ['CONVERTED', 'LOST'],
      CONVERTED: [],
      LOST: ['CONTACTED'],
    };
    const all = Object.keys(legal);

    for (const from of all) {
      for (const to of all) {
        if (from === to || legal[from].includes(to)) continue;

        prisma.kamnetLead.update.mockClear();
        existing({ status: from as KamnetLeadStatus });

        await expect(
          service.update(LEAD, AGENT, { status: to as KamnetLeadStatus }),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.kamnetLead.update).not.toHaveBeenCalled();
      }
    }
  });

  it('still allows every legal transition', async () => {
    const legal: Array<[string, string]> = [
      ['NEW', 'CONTACTED'],
      ['NEW', 'LOST'],
      ['CONTACTED', 'QUALIFIED'],
      ['CONTACTED', 'LOST'],
      ['QUALIFIED', 'CONVERTED'],
      ['QUALIFIED', 'LOST'],
      ['LOST', 'CONTACTED'],
    ];

    for (const [from, to] of legal) {
      prisma.kamnetLead.update.mockClear();
      existing({ status: from as KamnetLeadStatus });

      const result = await service.update(LEAD, AGENT, { status: to as KamnetLeadStatus });

      expect(prisma.kamnetLead.update).toHaveBeenCalledTimes(1);
      expect(writtenData()).toEqual(expect.objectContaining({ status: to }));
      expect(result).toBeDefined();
    }
  });

  it('writes every field a legal transition carries alongside the status', async () => {
    existing({ status: KamnetLeadStatus.CONTACTED });

    await service.update(LEAD, AGENT, {
      status: KamnetLeadStatus.QUALIFIED,
      clientName: 'Nom Modifie',
      clientEmail: 'modifie@example.test',
      clientPhone: '+237622222222',
      source: KamnetLeadSource.SOCIAL_MEDIA,
      notes: 'Qualifie apres visite',
    });

    expect(writtenData()).toEqual(
      expect.objectContaining({
        status: KamnetLeadStatus.QUALIFIED,
        clientName: 'Nom Modifie',
        clientEmail: 'modifie@example.test',
        clientPhone: '+237622222222',
        source: KamnetLeadSource.SOCIAL_MEDIA,
        notes: 'Qualifie apres visite',
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // convertedAt: stamped on the transition, and only on the transition
  // ---------------------------------------------------------------------------

  it('stamps convertedAt when the lead actually becomes CONVERTED', async () => {
    existing({ status: KamnetLeadStatus.QUALIFIED, convertedAt: null });

    await service.update(LEAD, AGENT, { status: KamnetLeadStatus.CONVERTED });

    expect(writtenData()).toEqual(
      expect.objectContaining({
        status: KamnetLeadStatus.CONVERTED,
        convertedAt: expect.any(Date),
      }),
    );
  });

  it('does not re-stamp convertedAt when a later PATCH repeats CONVERTED', async () => {
    /**
     * Today this passes for the wrong reason: the write never happens at all,
     * so nothing is stamped. After the fix the write DOES happen - the other
     * fields must reach the row - and the stamp is withheld because the status
     * did not transition. The date a lead converted is a fact about when that
     * happened; an edit afterwards is not a second conversion.
     */
    existing({ status: KamnetLeadStatus.CONVERTED, convertedAt: new Date('2026-01-01') });

    await service.update(LEAD, AGENT, {
      status: KamnetLeadStatus.CONVERTED,
      notes: 'Facture envoyee',
    });

    expect(prisma.kamnetLead.update).toHaveBeenCalledTimes(1);
    expect(writtenData()).toEqual(expect.objectContaining({ notes: 'Facture envoyee' }));
    expect(writtenData()).not.toHaveProperty('convertedAt');
  });

  it('does not stamp convertedAt on an edit that is not a conversion', async () => {
    await service.update(LEAD, AGENT, { notes: 'x' });

    expect(writtenData()).not.toHaveProperty('convertedAt');
  });

  // ---------------------------------------------------------------------------
  // OWNERSHIP: this PR fixes a write, and must not widen access
  // ---------------------------------------------------------------------------

  it('still refuses another agent lead, before writing anything', async () => {
    await expect(service.update(LEAD, OTHER_AGENT, { notes: 'not mine' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.kamnetLead.update).not.toHaveBeenCalled();
  });

  it('refuses another agent lead even when the patch carries a legal status change', async () => {
    // The status path was the one that worked; it must not be a way in.
    await expect(
      service.update(LEAD, OTHER_AGENT, { status: KamnetLeadStatus.CONVERTED }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.kamnetLead.update).not.toHaveBeenCalled();
  });

  it('still refuses a lead that does not exist', async () => {
    prisma.kamnetLead.findUnique.mockResolvedValue(null);

    await expect(service.update(LEAD, AGENT, { notes: 'x' })).rejects.toThrow(NotFoundException);
    expect(prisma.kamnetLead.update).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // The log line, which the fix must carry across
  // ---------------------------------------------------------------------------

  it('logs the update with the keys the dto changed', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.update(LEAD, AGENT, { notes: 'Rappeler lundi' });

    expect(log).toHaveBeenCalledWith(
      'Lead updated %o',
      expect.objectContaining({ leadId: LEAD, changed: expect.arrayContaining(['notes']) }),
    );
    log.mockRestore();
  });
});
