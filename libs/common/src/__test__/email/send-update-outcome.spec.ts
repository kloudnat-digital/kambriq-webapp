import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmailService } from '../../email/email.service';
import { isTransactional, SUPPRESSIBLE_TEMPLATES } from '../../email/templates';
import type { Queue } from 'bullmq';

/**
 * A11 - a caller could not tell a send from a skip.
 *
 * `sendUpdate` returned the same `Promise<void>` whether it queued a message or
 * dropped it, logged the drop at `debug`, and `UserProfile.emailNotifications`
 * **defaults to `false`** - so the skip was the normal path. On dev, all 70
 * users that have a profile row have it `false` and not one has it `true`.
 *
 * The preference is legitimate. The signature was the defect.
 */
const queue = () => ({ add: jest.fn().mockResolvedValue({ id: 'j1' }) }) as unknown as Queue;

const payload = (template: string) => ({
  to: 'someone@maildrop.cc',
  template: template as never,
  lang: 'fr',
  args: { firstName: 'Test' },
});

describe('sendUpdate tells the caller what it did', () => {
  it('reports a queued send', async () => {
    const service = new EmailService(queue());

    await expect(service.sendUpdate(payload('reservationCreated'), null)).resolves.toEqual({
      status: 'queued',
    });
  });

  it('reports a suppression instead of returning the same void as a send', async () => {
    const service = new EmailService(queue());

    // The assertion that fails on the old signature: it returned undefined for
    // both outcomes, so `toEqual({status:'suppressed'})` could not hold.
    await expect(
      service.sendUpdate(payload('reservationCreated'), { emailNotifications: false }),
    ).resolves.toEqual({ status: 'suppressed', reason: 'user-preference' });
  });

  it('the two outcomes are distinguishable, which is the whole point', async () => {
    const service = new EmailService(queue());

    const sent = await service.sendUpdate(payload('agentPromotion'), { emailNotifications: true });
    const skipped = await service.sendUpdate(payload('agentPromotion'), {
      emailNotifications: false,
    });

    expect(sent).not.toEqual(skipped);
    expect(sent.status).toBe('queued');
    expect(skipped.status).toBe('suppressed');
  });
});

describe('a preference cannot suppress a transactional message', () => {
  it.each([
    'reservationConfirmed',
    'reservationCancelled',
    'paymentConfirmed',
    'clientDocumentsValidated',
    'clientDocumentRejected',
    'dossierStarted',
    'certificateIssued',
    'examPassed',
    'examFailed',
    'applicationSubmitted',
    'applicationApproved',
    'applicationRejected',
  ])('sendUpdate throws on %s', async (template) => {
    const service = new EmailService(queue());

    await expect(service.sendUpdate(payload(template), null)).rejects.toThrow(
      /Refusing to route the transactional template/,
    );
  });

  it.each([...SUPPRESSIBLE_TEMPLATES])(
    '%s is suppressible, and sendUpdate accepts it',
    async (t) => {
      const service = new EmailService(queue());
      await expect(service.sendUpdate(payload(t), null)).resolves.toEqual({ status: 'queued' });
    },
  );

  it('the allow-list is an allow-list: an unknown template is transactional', () => {
    // Fails safe. A template nobody classified gets sent rather than dropped.
    expect(isTransactional('somethingNobodyClassified' as never)).toBe(true);
    expect(SUPPRESSIBLE_TEMPLATES.size).toBe(3);
  });
});

describe('no transactional template is routed through sendUpdate in the API', () => {
  /**
   * The barrier throws at runtime; this catches it at review time, and names
   * the file. Both are wanted: the throw stops a bad send, this stops a bad
   * merge.
   */
  // libs/common/src/__test__/email -> five levels to the repository root.
  const ROOT = join(__dirname, '..', '..', '..', '..', '..');
  const SITES = [
    'apps/api/src/lands/reservations/reservations.service.ts',
    'apps/api/src/kbs/certificates/certificates.service.ts',
    'apps/api/src/kbs/exam/grading-processor.ts',
    'apps/api/src/kamnet/agents/agents.service.ts',
    'apps/api/src/kamnet/applications/applications.service.ts',
  ];

  it.each(SITES)('%s routes only suppressible templates through sendUpdate', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const calls = [...src.matchAll(/sendUpdate\(([\s\S]{0,300}?)\)/g)];

    for (const call of calls) {
      const t = /template:\s*'([a-zA-Z]+)'/.exec(call[1])?.[1];
      // A parameterised template cannot be checked here, so it must not appear.
      expect(t).toBeDefined();
      expect(SUPPRESSIBLE_TEMPLATES.has(t as never)).toBe(true);
    }
  });

  it('is reading the files it thinks it is', () => {
    // A path that resolves nowhere throws; a path that resolves to an empty
    // file would make every assertion above vacuous.
    for (const rel of SITES) {
      expect(readFileSync(join(ROOT, rel), 'utf8').length).toBeGreaterThan(500);
    }
  });

  it('found the call sites at all', () => {
    const total =
      SITES.map((rel) => readFileSync(join(ROOT, rel), 'utf8'))
        .join('\n')
        .split('sendUpdate(').length - 1;
    // Three remain: two agent work-notifications and one status announcement.
    expect(total).toBe(3);
  });
});
