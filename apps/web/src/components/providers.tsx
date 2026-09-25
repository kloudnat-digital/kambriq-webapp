'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider } from 'next-auth/react';
import type { ClientSession } from '@/lib/session';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from './ui/tooltip';

export const Providers = ({
  children,
  session,
}: {
  children: React.ReactNode;
  /**
   * The session without its API bearer token. Everything passed to this
   * component is serialised into the RSC payload the browser downloads, so the
   * type refuses the field rather than relying on the caller to strip it.
   */
  session: ClientSession | null;
}) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SessionProvider session={session}>
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
          {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </NuqsAdapter>
    </SessionProvider>
  );
};
