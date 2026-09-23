'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * P11 - the way into the verifier for somebody who has not been handed a link.
 *
 * `/verify-certificate/[certificateNumber]` is a deep link and nothing else:
 * until now a visitor could only reach a verdict if somebody had already given
 * them the URL. The directory answers "which agents are certified"; this
 * answers "is THIS number real", for a number read off a card, a message or a
 * contract.
 *
 * ---------------------------------------------------------------------------
 * It validates shape, and deliberately not much
 * ---------------------------------------------------------------------------
 * The only check here is that something was typed. A stricter pattern would
 * refuse numbers the register might hold - the format has changed once already
 * (`KCA-YYYYMMDD-XXXX` today) - and refusing a real certificate in the browser
 * is worse than asking the register and being told UNKNOWN. The register is the
 * authority; this field is a door, not a gate.
 *
 * ---------------------------------------------------------------------------
 * No name search, by decision
 * ---------------------------------------------------------------------------
 * The subject is explicit that the verifier must not be searchable by name: the
 * directory is the name lookup and the verifier confirms a number. Two narrow
 * surfaces beat one that leaks, and `verifyCertificate` returns no name at all
 * so that a guessed number identifies nobody.
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
