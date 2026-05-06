'use client';

import { Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Control, FieldValues, Path } from 'react-hook-form';

interface LandLocationProps<T extends FieldValues> {
  control: Control<T>;
  fields: {
    latitude: { name: Path<T>; label: string; placeholder?: string };
    longitude: { name: Path<T>; label: string; placeholder?: string };
  };
  isSubmitting?: boolean;
}

export function LandLocationFields<T extends FieldValues>({
  control,
  fields,
  isSubmitting = false,
}: LandLocationProps<T>) {
  const t = useTranslations('landsAdmin');

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name={fields.latitude.name}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="f-lat">{fields.latitude.label}</FieldLabel>
              <Input
                {...field}
                max={90}
                min={-90}
                step="any"
                id="f-lat"
                type="number"
                disabled={isSubmitting}
                placeholder={fields.latitude.placeholder}
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  field.onChange(Number.isNaN(v) ? undefined : v);
                }}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name={fields.longitude.name}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="f-lng">{fields.longitude.label}</FieldLabel>
              <Input
                {...field}
                id="f-lng"
                type="number"
                step="any"
                min={-180}
                max={180}
                disabled={isSubmitting}
                placeholder={fields.longitude.placeholder}
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  field.onChange(Number.isNaN(v) ? undefined : v);
                }}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('form.locationHint')}</p>
    </>
  );
}
