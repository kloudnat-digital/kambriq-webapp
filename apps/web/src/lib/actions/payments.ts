'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, serverApi } from '@/lib/api/server';
import { createAction, ServerActionError } from './create-action';
import type { PaymentDetail, PaymentRow } from '@/types/payments';

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

/** Validates a payment. A separate, explicit act, with its reason recorded. */
export const validatePayment = createAction(
  async (input: { paymentId: string; reason: string; evidenceReceiptId?: string }) => {
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
  async (input: { paymentId: string; to: string; reason: string }) => {
    const { paymentId, ...body } = input;
    const result = await refusable(() =>
      serverApi.post(`/lands/admin/payments/${paymentId}/transition`, body),
    );
    revalidatePath(`/admin/payments/${paymentId}`);
    revalidatePath('/admin/payments');
    return result;
  },
);
