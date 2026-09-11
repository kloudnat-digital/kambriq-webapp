'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, serverApi } from '@/lib/api/server';
import { createAction, ServerActionError } from './create-action';
import type { PaymentDetail, PaymentRequestRow, PaymentRow } from '@/types/payments';

/**
 * Turns an API refusal into a result the screen can render.
 *
 * `createAction` converts a `ServerActionError` into `{ success: false, error }`
 * and **rethrows everything else**, which for a server component means the Next
 * error overlay. That is right for a bug and wrong for a refusal: the API saying
 * "INSTRUCTIONS_ENVOYEES -> VALIDE is not a legal step" is a correct answer to a
 * question the operator asked, and they should read it under the button they
 * pressed.
 *
 * The first version did not do this. The state machine refused the jump exactly
 * as designed, and the screen replied with a stack trace over the whole page -
 * a barrier working perfectly, reported as a crash.
 *
 * Only `ApiError` is converted. A `TypeError` here is still a bug and still
 * throws.
 */
const refusable = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ApiError) throw new ServerActionError(error.message, error.status);
    throw error;
  }
};

type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

/**
 * These types are the **unwrapped** payload, not the API envelope.
 *
 * `serverApi` already strips `{ success, data }` and returns `body.data` - except
 * for paginated responses, which carry `meta` and are passed through whole. So
 * `listPayments` is typed with its envelope and nothing else is.
 *
 * The first version of this file declared `<{ data: PaymentDetail }>` on every
 * call. TypeScript then believed in a `.data` that the runtime had already
 * removed, `nx typecheck web` was green, and the detail page threw
 * "Cannot read properties of undefined (reading 'reference')" the moment it was
 * opened. A type that lies is worse than no type: it makes the compiler agree
 * with the defect.
 */

export const listPayments = async (page = 1) =>
  serverApi.get<Paginated<PaymentRow>>(`/lands/admin/payments?page=${page}&limit=20`);

export const getPayment = async (id: string) =>
  serverApi.get<PaymentDetail>(`/lands/admin/payments/${id}`);

/** A presigned PUT for one proof. The object is private; this is not a public URL. */
export const getProofUploadUrl = createAction(
  async (input: { paymentId: string; fileName: string; contentType: string }) =>
    refusable(() =>
      serverApi.post<{ uploadUrl: string; key: string }>(
        `/lands/admin/payments/${input.paymentId}/proof-upload-url`,
        { fileName: input.fileName, contentType: input.contentType },
      ),
    ),
);

/** A short-lived link to read a proof back. */
export const getProofDownloadUrl = createAction(
  async (input: { paymentId: string; receiptId: string }) =>
    refusable(() =>
      serverApi.get<{ downloadUrl: string }>(
        `/lands/admin/payments/${input.paymentId}/receipts/${input.receiptId}/proof`,
      ),
    ),
);

/**
 * Records an encaissement. **Does not validate anything.**
 *
 * The two acts are separate calls in the API and separate actions here, so the
 * screen cannot accidentally do both - which is the mutation G4 is proved
 * against.
 */
export const recordReceipt = createAction(
  async (input: {
    paymentId: string;
    amount: string;
    currency: string;
    channel: string;
    receivedAt: string;
    evidenceUrl: string;
    /** Who actually paid, as declared. Required for DEPO. */
    paidBy?: string;
    note?: string;
    correctsId?: string;
  }) => {
    const { paymentId, ...body } = input;
    const result = await refusable(() =>
      serverApi.post(`/lands/admin/payments/${paymentId}/receipts`, body),
    );
    revalidatePath(`/admin/payments/${paymentId}`);
    return result;
  },
);

/**
 * Validates a payment. A separate, explicit act, with its reason recorded and
 * the receipt it rests on - G7's "sur quelle preuve". The API refuses a
 * validation that names none.
 */
export const validatePayment = createAction(
  async (input: { paymentId: string; reason: string; evidenceReceiptId: string }) => {
    const { paymentId, ...body } = input;
    const result = await refusable(() =>
      serverApi.post(`/lands/admin/payments/${paymentId}/validate`, body),
    );
    revalidatePath(`/admin/payments/${paymentId}`);
    revalidatePath('/admin/payments');
    return result;
  },
);

/**
 * Moves the payment one legal step. **Moves state and no money.**
 *
 * Separate from `recordReceipt` in the API and separate here, so the screen
 * cannot do both in one act - the property G4 is proved against.
 */
export const transitionPayment = createAction(
  async (input: { paymentId: string; to: string; reason: string; evidenceReceiptId?: string }) => {
    const { paymentId, ...body } = input;
    const result = await refusable(() =>
      serverApi.post(`/lands/admin/payments/${paymentId}/transition`, body),
    );
    revalidatePath(`/admin/payments/${paymentId}`);
    revalidatePath('/admin/payments');
    return result;
  },
);

// ---- G11-G14 ----

/** The queue of requests waiting for an answer, oldest first. */
export const listPaymentRequests = async (page = 1) =>
  serverApi.get<Paginated<PaymentRequestRow> & { meta: { oldestWaitingDays: number } }>(
    `/lands/admin/payments/requests?page=${page}&limit=20`,
  );

/**
 * Choose the channel and release the coordinates.
 *
 * `channel` is required and there is no default: the preference is shown beside
 * the choice, never preselected into it.
 */
export const sendInstructions = createAction(
  async (input: { paymentId: string; channel: string; reason: string }) => {
    const { paymentId, ...body } = input;
    const result = await refusable(() =>
      serverApi.post(`/lands/admin/payments/${paymentId}/send-instructions`, body),
    );
    revalidatePath(`/admin/payments/${paymentId}`);
    revalidatePath('/admin/payment-requests');
    return result;
  },
);

// ---- A14: the identity review queue ----

/** Identity documents awaiting review, oldest first. */
export const listPendingIdentities = async (page = 1) =>
  serverApi.get<
    Paginated<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      documentCount: number;
      submittedAt: string;
      waitingDays: number;
    }> & { meta: { oldestWaitingDays: number } }
  >(`/users/id-documents/pending?page=${page}&limit=20`);

/** One person, with their signed document links, for the reviewer to look at. */
export const getUserForReview = async (userId: string) =>
  serverApi.get<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profile: {
      idDocumentUrls: string[];
      idVerificationStatus: string;
      city: string | null;
      country: string | null;
    } | null;
  }>(`/users/id-documents/${userId}`);

/** Approve or reject. A rejection says why, and the client is told. */
export const reviewIdentity = createAction(
  async (input: { userId: string; status: 'verified' | 'rejected'; rejectionReason?: string }) => {
    const { userId, ...body } = input;
    const result = await refusable(() =>
      serverApi.patch(`/users/${userId}/id-document/review`, body),
    );
    revalidatePath('/admin/identities');
    revalidatePath('/admin/payment-requests');
    return result;
  },
);
