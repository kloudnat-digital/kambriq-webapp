import { Injectable, Logger } from '@nestjs/common';
import { CorePrismaService } from '../core/prisma/core-prisma.service';
import type { PolicyPublishPayload } from './policy-publish.dto';
import { renderPolicyHtml } from './policy-render';

/** The Sanity document type this webhook archives. */
export const POLICY_DOCUMENT_TYPE = 'legalPolicy';

/**
 * What the archive did, as a value the caller receives.
 *
 * A single `Promise<void>` would make "archived" and "ignored" indistinguishable
 * to the controller and to Sanity's attempt log.
 */
export type PolicyArchiveOutcome =
  | { status: 'archived'; id: string; slug: string; locale: string; revision: string }
  | { status: 'already-archived'; slug: string; locale: string; revision: string }
  | { status: 'ignored'; reason: string };

/** Prisma's code for a unique constraint refusal. */
const UNIQUE_VIOLATION = 'P2002';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === UNIQUE_VIOLATION;

/**
 * Archives the rendered text of a published legal policy.
 *
 * The bytes are stored rather than a reference to them. Sanity resolves a `_rev`
 * through its History API for three days on the current plan, and a consent
 * record has to answer for as long as the consent stands.
 *
 * The write is the success criterion. Rendering and storing both happen before
 * the request is answered, so a failure reaches Sanity as a non-2xx and is
 * retried, rather than being acknowledged and lost.
 */
@Injectable()
export class PolicyArchiveService {
  private readonly logger = new Logger(PolicyArchiveService.name);

  constructor(private readonly core: CorePrismaService) {}

  async archive(payload: PolicyPublishPayload): Promise<PolicyArchiveOutcome> {
    if (payload._type !== POLICY_DOCUMENT_TYPE) {
      // The Sanity webhook filter should not send these. Warn rather than fail:
      // a 4xx would have Sanity retry a delivery that will never be accepted,
      // and the misconfiguration is in Sanity, not in this payload.
      this.logger.warn(
        `Ignoring a '${payload._type}' document: this webhook archives '${POLICY_DOCUMENT_TYPE}' only.`,
      );
      return { status: 'ignored', reason: `not a ${POLICY_DOCUMENT_TYPE} document` };
    }

    const rendered = renderPolicyHtml(payload.body);

    const identity = {
      slug: payload.slug,
      locale: payload.locale,
      revision: payload._rev,
    };

    try {
      const row = await this.core.policySnapshot.create({
        data: {
          documentId: payload._id,
          revision: payload._rev,
          locale: payload.locale,
          slug: payload.slug,
          rendered,
          publishedAt: new Date(payload.publishedAt),
        },
      });

      this.logger.log(
        `Archived ${payload.slug} (${payload.locale}) at revision ${payload._rev} as ${row.id}.`,
      );
      return { status: 'archived', id: row.id, ...identity };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      /**
       * Which unique index refused is confirmed by reading the row back, not by
       * inspecting the error. Prisma 7 with the pg adapter reports the columns
       * at `meta.driverAdapterError.cause.constraint.fields` and does not set
       * `meta.target` at all, so any reader of that shape is coupled to the
       * driver. The database answers the question directly.
       *
       * A P2002 with no such row is a conflict on some other index, and it is
       * rethrown: reporting it as already-archived would turn an unrelated
       * failure into a success.
       */
      const archived = await this.core.policySnapshot.findFirst({
        where: { documentId: payload._id, revision: payload._rev },
        select: { id: true },
      });
      if (!archived) throw error;

      // Sanity retries a delivery it did not get an answer to, and a retry
      // carries the same revision. Answering 2xx is what stops the retries.
      this.logger.log(
        `Revision ${payload._rev} of ${payload.slug} (${payload.locale}) was already archived.`,
      );
      return { status: 'already-archived', ...identity };
    }
  }
}
