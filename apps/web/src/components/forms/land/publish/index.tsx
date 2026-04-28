'use client';

import { Controller } from 'react-hook-form';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface LandPublishProps<T extends FieldValues> {
  control: Control<T>;
  fields: {
    isPublished: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
    isVerified: {
      name: Path<T>;
      label: string;
      placeholder?: string;
    };
  };
  isSubmitting?: boolean;
}

export function LandPublishFields<T extends FieldValues>({
  control,
  fields,
  isSubmitting = false,
}: LandPublishProps<T>) {
  return (
    <>
      <Controller
        name={fields.isPublished.name}
        control={control}
        render={({ field }) => (
          <div className="flex items-center gap-3">
            <Checkbox
              id="f-published"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isSubmitting}
            />
            <Label htmlFor="f-published" className="cursor-pointer font-normal">
              {fields.isPublished.label}
            </Label>
          </div>
        )}
      />

      <Controller
        name={fields.isVerified.name}
        control={control}
        render={({ field }) => (
          <div className="flex items-center gap-3">
            <Checkbox
              id="f-verified"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isSubmitting}
            />
            <Label htmlFor="f-verified" className="cursor-pointer font-normal">
              {fields.isVerified.label}
            </Label>
          </div>
        )}
      />
    </>
  );
}
