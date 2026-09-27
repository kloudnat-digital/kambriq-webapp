'use client';

import { AlertTriangleIcon, CheckIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FC } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { verifyEmailAction } from '@/lib/actions/auth';
import { AUTH_ROUTES } from '@/routes';

type VerifyState = 'verifying' | 'success' | 'error';

const VerifyEmail: FC = () => {
  const t = useTranslations('auth.verifyEmail');
  const sp = useSearchParams();
  const token = sp.get('token');
  const [state, setState] = useState<VerifyState>('verifying');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setState('error');
        return;
      }
      const result = await verifyEmailAction(token);
      setState(result.success ? 'success' : 'error');
    };
    verify();
  }, [token]);

  const isVerifying = state === 'verifying';
  const isSuccess = state === 'success';
  const isError = state === 'error';

  return (
    <>
      <div>
        {/* Icon container */}
        <div
          className={`relative mx-auto flex size-12 items-center justify-center rounded-full transition-colors duration-300 ${isError ? 'bg-red-100' : 'bg-primary-100'}`}
        >
          <Spinner
            className={`absolute size-6 text-primary-600 transition-opacity duration-300 ${isVerifying ? 'opacity-100' : 'opacity-0'}`}
          />
          <CheckIcon
            className={`absolute size-6 text-primary-600 transition-opacity duration-300 ${isSuccess ? 'opacity-100' : 'opacity-0'}`}
          />
          <AlertTriangleIcon
            className={`absolute size-6 text-red-600 transition-opacity duration-300 ${isError ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        {/* Text */}
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-base font-semibold text-gray-900">
            {isVerifying && t('verifying')}
            {isSuccess && t('successHeading')}
            {isError && t('errorHeading')}
          </h3>
          <div className="mt-2">
            {isVerifying && <p className="text-sm text-gray-500">{t('waitMessage')}</p>}
            {isError && <p className="text-sm text-gray-500">{t('errorMessage')}</p>}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="mt-5 sm:mt-6">
        <Button asChild disabled={isVerifying} className="h-10 w-full">
          <Link href={AUTH_ROUTES.LOGIN}>{isSuccess ? t('goToLogin') : t('backToLogin')}</Link>
        </Button>
      </div>
    </>
  );
};

export default VerifyEmail;
