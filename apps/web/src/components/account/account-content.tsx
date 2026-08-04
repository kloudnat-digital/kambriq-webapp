'use client';

import type { Me } from '@/types/account';
import { AccountProfileCard } from './account-profile-card';
import { AccountPreferencesCard } from './account-preferences-card';
import { AccountSecurityCard } from './account-security-card';

interface AccountContentProps {
  me: Me;
}

export const AccountContent = ({ me }: AccountContentProps) => {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section aria-labelledby="user-information">
        <AccountProfileCard me={me} />
      </section>
      <section aria-labelledby="user-preferences">
        <AccountPreferencesCard me={me} />
      </section>
      <section aria-label="user-security">
        <AccountSecurityCard />
      </section>
    </div>
  );
};
