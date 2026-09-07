'use server';

import { serverApi } from '@/lib/api/server';
import { createAction, ServerActionError } from './create-action';
import { getUserRoles, isAdminRole, buildQuery } from './utils/lands';
import type { CreateLandFormSchema } from '@/validations/schema/lands';
import type { LandClientDocumentType, LandLabel } from '@/types/lands';

// ---- Purchases ----

export const getMyPurchases = createAction(async () => {
  return serverApi.get('/lands/client/purchases');
});

export const getPurchaseDetail = createAction(async (id: string) => {
  return serverApi.get(`/lands/client/purchases/${id}`);
});

// ---- G9: the payment entry point ----

/**
 * The client asks to pay the acompte on their own reservation.
 *
 * **No amount is sent.** It is read from the reservation server-side, because a
 * caller who can name their own amount can decide what they owe. Asking twice
 * returns the payment that already exists rather than creating a second.
 */
export const requestPaymentAction = createAction(async (reservationId: string) => {
  return serverApi.post<{
    id: string;
    reference: string;
    amountDue: string;
    currency: string;
  }>(`/lands/client/purchases/${reservationId}/payment`);
});

/**
 * A separate act from creating the payment, exactly as recording an encaissement
 * is separate from validating one. If the email fails the payment still exists,
 * and the reference is on screen either way.
 */
export const sendMyInstructionsAction = createAction(async (paymentId: string) => {
  return serverApi.post<{ state: string; reference: string }>(
    `/lands/client/payments/${paymentId}/instructions`,
  );
});

export const getClientDocumentUploadUrlAction = createAction(
  async (
    reservationId: string,
    data: { type: LandClientDocumentType; filename: string; contentType: string },
  ) => {
    return serverApi.post<{ uploadUrl: string; fileUrl: string }>(
      `/lands/client/purchases/${reservationId}/documents/upload-url`,
      data,
    );
  },
);

export const registerClientDocumentAction = createAction(
  async (
    reservationId: string,
    data: { type: LandClientDocumentType; url: string; name: string },
  ) => {
    return serverApi.post(`/lands/client/purchases/${reservationId}/documents`, data);
  },
);

export const deleteClientDocumentAction = createAction(
  async (reservationId: string, documentId: string) => {
    return serverApi.delete(`/lands/client/purchases/${reservationId}/documents/${documentId}`);
  },
);

export const rejectClientDocumentAction = createAction(
  async (reservationId: string, documentId: string, reason: string) => {
    try {
      return await serverApi.post(
        `/lands/admin/reservations/${reservationId}/documents/${documentId}/reject`,
        { reason },
      );
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Document rejection failed.',
        400,
      );
    }
  },
);

// ---- Lands ----

export const getLandsAction = createAction(
  async (params?: {
    search?: string;
    labelCode?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const roles = await getUserRoles();
    const base = isAdminRole(roles) ? '/lands/admin' : '/lands';
    return serverApi.get(`${base}${buildQuery(params ?? {})}`);
  },
);

export const getLandById = createAction(async (id: string) => {
  const roles = await getUserRoles();
  const base = isAdminRole(roles) ? '/lands/admin' : '/lands';
  return serverApi.get(`${base}/${id}`);
});

export const createLandAction = createAction(async (data: CreateLandFormSchema) => {
  try {
    return await serverApi.post('/lands/admin', data);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Land creation failed.',
      400,
    );
  }
});

export const updateLandAction = createAction(async (id: string, data: CreateLandFormSchema) => {
  try {
    return await serverApi.patch(`/lands/admin/${id}`, data);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Land update failed.',
      400,
    );
  }
});

export const archiveLandAction = createAction(async (id: string) => {
  try {
    return await serverApi.delete(`/lands/admin/${id}`);
  } catch (error) {
    throw new ServerActionError(error instanceof Error ? error.message : 'Archive failed.', 400);
  }
});

export const toggleLandPublishAction = createAction(async (id: string, isPublished: boolean) => {
  try {
    return await serverApi.patch(`/lands/admin/${id}`, { isPublished });
  } catch (error) {
    throw new ServerActionError(error instanceof Error ? error.message : 'Update failed.', 400);
  }
});

export const getLabelsAction = createAction(async () => {
  return serverApi.get<LandLabel[]>('/lands/admin/labels');
});

export const getLandsStatsAction = createAction(async () => {
  return serverApi.get<{
    available: number;
    reserved: number;
    sold: number;
    pendingReservations: number;
  }>('/lands/admin/stats');
});

// ---- Reservations ----

export const getReservationsAction = createAction(
  async (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const roles = await getUserRoles();
    const path = isAdminRole(roles) ? '/lands/admin/reservations' : '/lands/reservations/mine';
    return serverApi.get(`${path}${buildQuery(params ?? {})}`);
  },
);

export const getReservationById = createAction(async (id: string) => {
  return serverApi.get(`/lands/reservations/${id}`);
});

export const createReservationAction = createAction(
  async (data: {
    landId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
  }) => {
    try {
      return await serverApi.post('/lands/reservations', data);
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'La réservation a échoué.',
        400,
      );
    }
  },
);

export const confirmReservationAction = createAction(async (id: string) => {
  try {
    return await serverApi.post(`/lands/admin/reservations/${id}/confirm`);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Confirmation échouée.',
      400,
    );
  }
});

export const markDocsReceivedAction = createAction(async (id: string) => {
  try {
    return await serverApi.post(`/lands/admin/reservations/${id}/documents-received`);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Mise à jour échouée.',
      400,
    );
  }
});

export const confirmPaymentAction = createAction(async (id: string) => {
  try {
    return await serverApi.post(`/lands/admin/reservations/${id}/payment-confirmed`);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Confirmation paiement échouée.',
      400,
    );
  }
});

export const startDossierAction = createAction(async (id: string) => {
  try {
    return await serverApi.post(`/lands/admin/reservations/${id}/dossier-started`);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Démarrage dossier échoué.',
      400,
    );
  }
});

export const completeReservationAction = createAction(async (id: string) => {
  try {
    return await serverApi.post(`/lands/admin/reservations/${id}/complete`);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Finalisation échouée.',
      400,
    );
  }
});

export const cancelReservationAction = createAction(async (id: string, reason: string) => {
  const roles = await getUserRoles();
  const base = isAdminRole(roles) ? '/lands/admin' : '/lands';
  try {
    return await serverApi.post(`${base}/reservations/${id}/cancel`, { reason });
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Annulation échouée.',
      400,
    );
  }
});

export const inviteClientAction = createAction(
  async (data: { email: string; firstName: string; lastName: string; phone?: string }) => {
    try {
      return await serverApi.post('/lands/admin/invite', data);
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : "L'invitation a échoué.",
        400,
      );
    }
  },
);

// ---- Media ----

export const getLandUploadUrl = createAction(
  async (
    landId: string,
    file: { filename: string; contentType: string },
    category: 'MEDIA' | 'DOCUMENT' = 'MEDIA',
  ) => {
    return serverApi.post<{ uploadUrl: string; fileUrl: string }>(
      `/lands/admin/${landId}/upload-url`,
      { ...file, category },
    );
  },
);

export const addMediaAction = createAction(
  async (data: { landId: string; type: 'IMAGE' | 'VIDEO'; url: string }) => {
    return serverApi.post('/lands/admin/media', data);
  },
);

export const deleteMediaAction = createAction(async (id: string) => {
  try {
    return await serverApi.delete(`/lands/admin/media/${id}`);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Media deletion failed.',
      400,
    );
  }
});

// ---- Documents ----

export const addDocumentAction = createAction(
  async (data: { landId: string; type: string; name: string; url: string; isPrivate: boolean }) => {
    return serverApi.post('/lands/admin/documents', data);
  },
);

export const deleteDocumentAction = createAction(async (id: string) => {
  try {
    return await serverApi.delete(`/lands/admin/documents/${id}`);
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Document deletion failed.',
      400,
    );
  }
});
