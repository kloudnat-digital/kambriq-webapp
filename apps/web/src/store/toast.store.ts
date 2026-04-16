import { create } from 'zustand';
import type { ExternalToast } from 'sonner';

export type ToastStatus = 'success' | 'error' | 'info' | 'warning' | 'loading' | 'message';

export type ToastConfig = ExternalToast & {
  id: string;
  status: ToastStatus;
  title: string;
};

export type CreateToastInput = Omit<ToastConfig, 'id'>;

type ToastStore = {
  toasts: ToastConfig[];
  createToast: (input: CreateToastInput) => void;
  deleteToast: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  createToast: (input) =>
    set((state) => ({
      toasts: [...state.toasts, { ...input, id: crypto.randomUUID() }],
    })),
  deleteToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
