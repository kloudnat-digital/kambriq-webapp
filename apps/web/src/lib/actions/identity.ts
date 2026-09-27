'use server';

import { serverApi } from '@/lib/api/server';
import { createAction, ServerActionError } from './create-action';
import type { PresignedUpload } from '@/types/kbs';

/**
 * The signed-in person's identity document, for every flow that asks for it:
 * KBS enrolment and the payment page (I47). The API returns a storage key in
 * `fileUrl`, and the key is what is submitted and stored (A49).
 */
export const getIdUploadUrl = createAction(
  async (data: { filename: string; contentType: string }) => {
    return serverApi.post<PresignedUpload>('/users/me/id-document/upload-url', data);
  },
);

export const submitIdDocuments = createAction(async (idDocumentUrls: string[]) => {
  try {
    return await serverApi.patch('/users/me/id-document', { idDocumentUrls });
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'ID document submission failed.',
      400,
    );
  }
});
