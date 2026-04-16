'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { inviteClient } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const empty: FormState = { email: '', firstName: '', lastName: '', phone: '' };

export const InviteForm = () => {
  const [form, setForm] = useState<FormState>(empty);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => inviteClient(form).then(unwrap),
    onSuccess: () => {
      setSuccess(true);
      setForm(empty);
    },
  });

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    setSuccess(false);
  };

  const validate = () => {
    const errors: Partial<FormState> = {};
    if (!form.email.trim()) errors.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email invalide';
    if (!form.firstName.trim()) errors.firstName = 'Prénom requis';
    if (!form.lastName.trim()) errors.lastName = 'Nom requis';
    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-gray-900">Informations du client</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Prénom <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.firstName}
              onChange={set('firstName')}
              placeholder="Jean"
              className={cn(fieldErrors.firstName && 'border-red-400 focus-visible:ring-red-400')}
            />
            {fieldErrors.firstName && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.firstName}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nom <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.lastName}
              onChange={set('lastName')}
              placeholder="Kouassi"
              className={cn(fieldErrors.lastName && 'border-red-400 focus-visible:ring-red-400')}
            />
            {fieldErrors.lastName && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.lastName}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="jean.kouassi@exemple.com"
              className={cn(fieldErrors.email && 'border-red-400 focus-visible:ring-red-400')}
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
            <p className="mt-1 text-xs text-gray-400">
              Un email d&apos;invitation sera envoyé à cette adresse.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Téléphone <span className="font-normal text-gray-400">(optionnel)</span>
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+225 07 00 00 00 00"
            />
          </div>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            Invitation envoyée avec succès. Le client recevra un email pour créer son compte.
          </span>
        </div>
      )}

      {/* Error */}
      {mutation.isError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            {(mutation.error as Error)?.message ?? 'Une erreur est survenue. Veuillez réessayer.'}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {mutation.isPending && <Spinner className="size-4" />}
        Envoyer l&apos;invitation
      </button>
    </form>
  );
};
