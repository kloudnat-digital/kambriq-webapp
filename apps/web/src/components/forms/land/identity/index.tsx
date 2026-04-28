'use client';

import { Controller } from 'react-hook-form';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  SelectTrigger,
  Select,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { CAMEROON_REGIONS } from '@/constants/country';

interface LandIdentityProps<T extends FieldValues> {
  control: Control<T>;
  fields: {
    title: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    description: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    region: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    city: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    neighborhood: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
  };
  isSubmitting?: boolean;
}

export function LandIdentityFields<T extends FieldValues>({
  control,
  fields,
  isSubmitting = false,
}: LandIdentityProps<T>) {
  return (
    <>
      <Controller
        name={fields.title.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="f-title">{fields.title.label} *</FieldLabel>
            <Input
              {...field}
              id="f-title"
              placeholder={fields.title.placeholder}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={fields.description.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="f-desc">{fields.description.label} *</FieldLabel>
            <Textarea
              {...field}
              id="f-desc"
              rows={3}
              placeholder={fields.description.placeholder}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={fields.region.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>{fields.region.label} *</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={fields.region.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {CAMEROON_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={fields.city.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="f-city">{fields.city.label}</FieldLabel>
            <Input
              {...field}
              id="f-city"
              placeholder={fields.city.placeholder}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name={fields.neighborhood.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="f-neighborhood">{fields.neighborhood.label}</FieldLabel>
            <Input
              {...field}
              id="f-neighborhood"
              placeholder={fields.neighborhood.placeholder}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </>
  );
}
