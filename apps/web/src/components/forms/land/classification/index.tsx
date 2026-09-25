'use client';

import { Controller } from 'react-hook-form';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import {
  SelectTrigger,
  Select,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import type { LandLabel } from '@/types/lands';
import { TITLE_NUMBER_EXAMPLE } from '@kambriq/common/lands/title-number';

interface LandClassificationProps<T extends FieldValues> {
  control: Control<T>;
  fields: {
    labelId: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    ownerType: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    titleNumber: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
  };
  isSubmitting?: boolean;
  labels: LandLabel[];
}

export function LandClassificationFields<T extends FieldValues>({
  control,
  fields,
  isSubmitting = false,
  labels,
}: LandClassificationProps<T>) {
  const t = useTranslations('landsAdmin');
  return (
    <>
      <Controller
        name={fields.labelId.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>{fields.labelId.label} *</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={fields.labelId.placeholder} />
              </SelectTrigger>
              <SelectContent className="w-full">
                {labels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    <span className="font-mono font-semibold">{l.code}</span>
                    <span className="text-xs text-muted-foreground"> - {l.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={fields.ownerType.name}
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel>{fields.ownerType.label}</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={fields.ownerType.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KAMBRIQ">KAMBRIQ</SelectItem>
                <SelectItem value="PARTNER">{t('form.partner')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      <Controller
        name={fields.titleNumber.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="f-tf">{fields.titleNumber.label}</FieldLabel>
            <Input
              {...field}
              id="f-tf"
              placeholder={fields.titleNumber.placeholder}
              className="font-mono"
              disabled={isSubmitting}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.invalid ? 'f-tf-error' : undefined}
            />
            {/* P24: the refusal says the expected shape, with an example. */}
            {fieldState.invalid && (
              <FieldError id="f-tf-error">
                {t('form.titleNumberInvalid', { example: TITLE_NUMBER_EXAMPLE })}
              </FieldError>
            )}
          </Field>
        )}
      />
    </>
  );
}
