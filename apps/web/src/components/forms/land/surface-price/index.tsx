'use client';

import { Controller } from 'react-hook-form';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { Input } from '@/components/ui/input';

interface LandSurfacePriceProps<T extends FieldValues> {
  control: Control<T>;
  fields: {
    sizeM2: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    totalPrice: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    pv: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
  };
  isSubmitting?: boolean;
}

export function LandSurfacePriceFields<T extends FieldValues>({
  control,
  fields,
  isSubmitting = false,
}: LandSurfacePriceProps<T>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name={fields.sizeM2.name}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="f-size">{fields.sizeM2.label} (m²) *</FieldLabel>
              <Input
                {...field}
                id="f-size"
                type="number"
                min={1}
                disabled={isSubmitting}
                placeholder={fields.sizeM2.placeholder}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name={fields.totalPrice.name}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="f-total-price">{fields.totalPrice.label} (XAF) *</FieldLabel>
              <Input
                {...field}
                id="f-total-price"
                type="number"
                min={1}
                disabled={isSubmitting}
                placeholder={fields.totalPrice.placeholder}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <Controller
        name={fields.pv.name}
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="f-pv">
              {fields.pv.label} <span className="text-xs text-muted-foreground">(0.1 - 2.0)</span>
            </FieldLabel>
            <Input
              {...field}
              id="f-pv"
              type="number"
              step={0.1}
              min={0.1}
              max={2.0}
              disabled={isSubmitting}
              placeholder={fields.pv.placeholder}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </>
  );
}
