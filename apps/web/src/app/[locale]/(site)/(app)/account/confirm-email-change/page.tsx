'use client';

import { AlertTriangleIcon, CheckIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FC } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { confirmEmailChange } from '@/lib/actions/account';
import { logOutToLoginAction } from '@/lib/actions/auth';

type ConfirmState = 'confirming' | 'success' | 'error';

/**
 * I45 - the page the email-change link leads to. It did not exist: the API
 * emailed `/auth/confirm-email-change`, which answered 404.
 *
 * Behind `/account`, so the proxy sends a person who is not signed in to the
 * login page and back here: the API binds the token to the account that asked.
 * On success the API has revoked every session, this browser's included, so
 * the button signs out and goes to the login page, for the new address.
 *
 * The words are `auth.verifyEmail`'s - checking a link, success, "the link may
 * have expired or has already been used", go to login - so no copy is new.
 */
const ConfirmEmailChange: FC = () => {
  const t = useTranslations('auth.verifyEmail');
  const token = useSearchParams().get('token');
  const [state, setState] = useState<ConfirmState>('confirming');

  useEffect(() => {
    const confirm = async () => {
      if (!token) {
        setState('error');
        return;
      }
      const result = await confirmEmailChange(token);
      setState(result.success ? 'success' : 'error');
    };
    confirm();
  }, [token]);

  const isConfirming = state === 'confirming';
  const isSuccess = state === 'success';
  const isError = state === 'error';

  return (
    <div className="mx-auto max-w-md py-12">
      <div
        className={`relative mx-auto flex size-12 items-center justify-center rounded-full ${isError ? 'bg-red-100' : 'bg-primary-100'}`}
      >
        {isConfirming && <Spinner className="size-6 text-primary-600" />}
        {isSuccess && <CheckIcon className="size-6 text-primary-600" />}
        {isError && <AlertTriangleIcon className="size-6 text-red-600" />}
      </div>

      <div className="mt-3 text-center sm:mt-5">
        <h1 className="text-base font-semibold text-gray-900">
          {isConfirming && t('verifying')}
          {isSuccess && t('successHeading')}
          {isError && t('errorHeading')}
        </h1>
        {isError && <p className="mt-2 text-sm text-gray-500">{t('errorMessage')}</p>}
      </div>

      {isSuccess && (
        <form action={logOutToLoginAction} className="mt-5 sm:mt-6">
          <Button type="submit" className="h-10 w-full">
            {t('goToLogin')}
          </Button>
        </form>
      )}
    </div>
  );
};

export default ConfirmEmailChange;
