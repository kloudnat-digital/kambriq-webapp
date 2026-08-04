'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import { updateMe } from '@/lib/actions/account';
import { ProfileFormResolver, type ProfileFormSchema } from '@/validations/schema/account';
import type { Me } from '@/types/account';
import { AvatarUploader } from './avatar-uploader';
import { ChangeEmailModal } from './change-email-modal';

interface AccountProfileCardProps {
  me: Me;
}

export const AccountProfileCard = ({ me }: AccountProfileCardProps) => {
  const t = useTranslations('app.account.profile');
  const pathname = usePathname();
  const { createToast } = useToastStore();
  const [emailOpen, setEmailOpen] = useState(false);

  const { control, handleSubmit, formState } = useForm<ProfileFormSchema>({
    resolver: zodResolver(ProfileFormResolver),
    defaultValues: {
      firstName: me.firstName,
      lastName: me.lastName,
      phone: me.phone ?? '',
      address: me.profile?.address ?? '',
      city: me.profile?.city ?? '',
      country: me.profile?.country ?? '',
    },
  });

  const { isSubmitting } = formState;

  const errText = (key: string | undefined) => (key ? t(key as never) : undefined);

  const onSubmit = async (data: ProfileFormSchema) => {
    const payload = {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      country: data.country ?? '',
    };

    const result = await updateMe(payload, pathname);
    if (!result.success) {
      createToast({ status: 'error', title: result.error || t('saveError') });
      return;
    }
    createToast({ status: 'success', title: t('saveSuccess') });
  };

  console.log(me);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <AvatarUploader
            avatarUrl={me.profile?.avatarUrl ?? null}
            firstName={me.firstName}
            lastName={me.lastName}
          />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-4 gap-6">
              <Controller
                name="firstName"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="col-span-4 sm:col-span-2">
                    <FieldLabel htmlFor="firstName">{t('firstName')}</FieldLabel>
                    <Input
                      {...field}
                      id="firstName"
                      autoComplete="given-name"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <FieldError errors={[{ message: errText(fieldState.error.message) }]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                name="lastName"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="col-span-4 sm:col-span-2">
                    <FieldLabel htmlFor="lastName">{t('lastName')}</FieldLabel>
                    <Input
                      {...field}
                      id="lastName"
                      autoComplete="family-name"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <FieldError errors={[{ message: errText(fieldState.error.message) }]} />
                    )}
                  </Field>
                )}
              />

              <Field className="col-span-4 sm:col-span-2">
                <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input id="email" value={me.email} readOnly disabled className="flex-1" />
                  <Button type="button" variant="outline" onClick={() => setEmailOpen(true)}>
                    {t('changeEmail')}
                  </Button>
                </div>
              </Field>

              <Controller
                name="phone"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="col-span-4 sm:col-span-2">
                    <FieldLabel htmlFor="phone">{t('phone')}</FieldLabel>
                    <Input
                      {...field}
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      aria-invalid={fieldState.invalid}
                    />
                  </Field>
                )}
              />

              <Controller
                name="address"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="col-span-4 sm:col-span-2">
                    <FieldLabel htmlFor="address">{t('address')}</FieldLabel>
                    <Input
                      {...field}
                      id="address"
                      autoComplete="street-address"
                      aria-invalid={fieldState.invalid}
                    />
                  </Field>
                )}
              />

              <Controller
                name="city"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="col-span-4 sm:col-span-1">
                    <FieldLabel htmlFor="city">{t('city')}</FieldLabel>
                    <Input {...field} id="city" autoComplete="address-level2" />
                  </Field>
                )}
              />
              <Controller
                name="country"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="col-span-4 sm:col-span-1">
                    <FieldLabel htmlFor="country">{t('country')}</FieldLabel>
                    <Input {...field} id="country" autoComplete="country-name" />
                  </Field>
                )}
              />
            </div>

            <div className="text-right">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner className="size-4" />}
                {isSubmitting ? t('saving') : t('save')}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>

      <ChangeEmailModal open={emailOpen} onOpenChange={setEmailOpen} />
    </Card>
  );
};
