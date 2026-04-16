'use client';

import type { FC } from 'react';
import { toast } from 'sonner';
import { useToastStore } from '@/store/toast.store';

const ToastContainer: FC = () => {
  const { toasts, deleteToast } = useToastStore();

  toasts.forEach(({ id, status, title, ...options }) => {
    toast[status](title, {
      id,
      ...options,
      onDismiss: () => deleteToast(id),
      onAutoClose: () => deleteToast(id),
    });
  });

  return null;
};

export default ToastContainer;
