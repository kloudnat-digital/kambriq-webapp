import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AuthShell } from '@/components/auth/auth-shell';

/**
 * The server half of the authentication shell, which exists to carry metadata.
 *
 * The shell itself is a Client Component - it holds the language toggle and
 * reads the pathname - and a Client Component cannot export `metadata`. So all
 * six auth pages had none, and on a production deployment `/fr/login` was as
 * indexable as the home page.
 *
 * `robots.txt` disallows these paths as well. Both are needed and they are not
 * the same instruction: `Disallow` asks a crawler not to FETCH the page, and a
 * page linked from somewhere else can still be indexed on the strength of that
 * link alone, with no fetch. Only this directive refuses the indexing.
 *
 * `follow` stays on: the links out of these pages point at the public site, and
 * there is no reason to strand them.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

const AuthLayout = ({ children }: { children: ReactNode }) => <AuthShell>{children}</AuthShell>;

export default AuthLayout;
