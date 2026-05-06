'use client';

import { useTranslations } from 'next-intl';
import type { ComponentPropsWithoutRef, FC } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Field, FieldError } from '../ui/field';
import { Controller, useForm } from 'react-hook-form';
import type { SubscribeNewsletterSchema } from '@/validations/schema/subscribe';
import { SubscribeNewsletterResolver } from '@/validations/schema/subscribe';
import { zodResolver } from '@hookform/resolvers/zod';
import { subscribeNewsletterAction } from '@/lib/actions/newsletter';
import { useToastStore } from '@/store/toast.store';

type NewsletterSignupProps = ComponentPropsWithoutRef<'div'>;

const NewsletterSignup: FC<NewsletterSignupProps> = ({ className }) => {
  const t = useTranslations('footer.newsletter');

  const { createToast } = useToastStore();

  const methods = useForm<SubscribeNewsletterSchema>({
    resolver: zodResolver(SubscribeNewsletterResolver),
    defaultValues: {
      email: '',
    },
  });

  const handleSubmit = async (data: SubscribeNewsletterSchema) => {
    const result = await subscribeNewsletterAction(data.email);
    if (result.success) {
      createToast({ status: 'success', title: t('success.title') });
      methods.reset();
    } else {
      createToast({ status: 'error', title: result.error });
    }
  };

  return (
    <div
      className={cn(
        'border-t border-primary-foreground/20 pt-8 sm:mt-20 lg:mt-24 lg:flex lg:items-center lg:justify-between',
        className,
      )}
    >
      <div>
        <h3 className="text-sm/6 font-semibold">{t('title')}</h3>
        <p className="mt-2 text-sm/6">{t('description')}</p>
      </div>
      <form className="mt-6 sm:max-w-md lg:mt-0" onSubmit={methods.handleSubmit(handleSubmit)}>
        <div className="w-full sm:flex sm:items-start">
          <Controller
            name="email"
            control={methods.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="w-full">
                <Input
                  {...field}
                  id="email"
                  type="email"
                  aria-invalid={fieldState.invalid}
                  placeholder={t('placeholder')}
                  autoComplete="email"
                  className="h-10 border-primary-foreground/20 bg-background/10 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:border-primary-foreground/40"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="mt-4 sm:mt-0 sm:ml-4 sm:shrink-0">
            <Button type="submit" variant="secondary" className="h-10 whitespace-nowrap">
              {t('submit')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default NewsletterSignup;
