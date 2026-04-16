'use server';

import { serverApi } from '@/lib/api/server';
import { createAction, ServerActionError } from './create-action';
import { getUserRoles, isAdminRole, buildQuery } from './utils/lands';

export const getMyPurchases = createAction(async () => {
  return serverApi.get('/lands/client/purchases');
});

export const getPurchaseDetail = createAction(async (id: string) => {
  return serverApi.get(`/lands/client/purchases/${id}`);
});

export const getLands = createAction(
  async (params?: { search?: string; label?: string; status?: string; limit?: number }) => {
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

export const getReservations = createAction(
  async (params?: { search?: string; status?: string; limit?: number }) => {
    const roles = await getUserRoles();
    const path = isAdminRole(roles) ? '/lands/admin/reservations' : '/lands/reservations/mine';
    return serverApi.get(`${path}${buildQuery(params ?? {})}`);
  },
);

export const getReservationById = createAction(async (id: string) => {
  const roles = await getUserRoles();
  const base = isAdminRole(roles) ? '/lands/admin' : '/lands';
  return serverApi.get(`${base}/reservations/${id}`);
});

export const createReservation = createAction(
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

export const reservationAction = createAction(async (id: string, action: string) => {
  try {
    return await serverApi.post(`/lands/admin/reservations/${id}/${action}`);
  } catch (error) {
    throw new ServerActionError(error instanceof Error ? error.message : 'Action échouée.', 400);
  }
});

export const cancelReservation = createAction(async (id: string, reason: string) => {
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

export const inviteClient = createAction(
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
