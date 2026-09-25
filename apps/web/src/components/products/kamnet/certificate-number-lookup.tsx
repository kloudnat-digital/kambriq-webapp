'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Renders the manual entry field for certificate verification (P11).
 *
 * Implements loose validation by design: accepts any non-empty input and delegates
 * strict format validation to the server (`verifyCertificate`). This prevents the
 * client from inadvertently rejecting legacy certificate formats.
 *
 * Exclusively searches by certificate number. Name-based search is deliberately
 * restricted to the public directory to prevent unauthorized data enumeration
 * via the verifier endpoint.
 */
export const CertificateNumberLookup = ({ className }: { className?: string }) => {
  const t = useTranslations('products.kamnet.directory');
  const router = useRouter();

  const inputId = useId();
  const errorId = `${inputId}-error`;

  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const number = value.trim();
    if (number === '') {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    router.push(`/verify-certificate/${encodeURIComponent(number)}`);
  };

  return (
    <form onSubmit={submit} noValidate className={cn('space-y-2', className)}>
      <Label htmlFor={inputId}>{t('lookupLabel')}</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id={inputId}
          name="kcaNumber"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (invalid) setInvalid(false);
          }}
          placeholder={t('lookupPlaceholder')}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className="font-mono sm:flex-1"
        />
        <Button type="submit" className="sm:w-auto">
          {t('lookupCta')}
        </Button>
      </div>
      {invalid ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t('lookupInvalid')}
        </p>
      ) : null}
    </form>
  );
};
