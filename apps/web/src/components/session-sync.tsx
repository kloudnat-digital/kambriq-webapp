'use client';

import { useAuthStore } from '@/store/auth.store';
import { useSession, signOut } from 'next-auth/react';

import { useEffect, type FC } from 'react';

const SessionSync: FC = () => {
  const { data: session } = useSession();
  const { setAccessToken, clearAccessToken } = useAuthStore();

  useEffect(() => {
    if (session?.error === 'RefreshTokenError') {
      clearAccessToken();
      signOut({ callbackUrl: '/login' });
      return;
    }

    if (session?.accessToken) {
      setAccessToken(session.accessToken);
    } else {
      clearAccessToken();
    }
  }, [session?.accessToken, session?.error, setAccessToken, clearAccessToken]);

  return null;
};

export default SessionSync;
