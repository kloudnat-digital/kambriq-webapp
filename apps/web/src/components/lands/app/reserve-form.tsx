'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getLandById, createReservation } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formatPrice = (p: number) => new Intl.NumberFormat('fr-FR').format(p);

interface LandSummary {
  title: string;
  price: number;
  sizeM2: number;
  label?: { code: string };
  status?: string;
}

interface Props {
  landId: string;
}

export const ReserveForm = ({ landId }: Props) => {
  const router = useRouter();

  const { data: land, isLoading: landLoading } = useQuery<LandSummary>({
    queryKey: ['land', landId],
    queryFn: () => getLandById(landId).then(unwrap) as Promise<LandSummary>,
  });

  const [form, setForm] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => createReservation({ landId, ...form }).then(unwrap),
    onSuccess: (data) => {
      const id = (data as { id?: string })?.id;
      if (id) router.push(`/reservations/${id}`);
    },
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.clientName.trim()) errors.clientName = 'Nom requis';
    if (!form.clientEmail.trim()) errors.clientEmail = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail))
      errors.clientEmail = 'Email invalide';
    if (!form.clientPhone.trim()) errors.clientPhone = 'Téléphone requis';
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

  if (landLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!land) return null;

  const acompte = land.price && land.sizeM2 ? Math.round(land.price * land.sizeM2 * 0.05) : null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href={`/lands/${landId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Réserver ce terrain</h1>
          <p className="text-sm text-gray-500">{land.title}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Informations client</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nom complet <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.clientName}
                  onChange={set('clientName')}
                  placeholder="Prénom et nom du client"
                  className={cn(
                    fieldErrors.clientName && 'border-red-400 focus-visible:ring-red-400',
                  )}
                />
                {fieldErrors.clientName && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.clientName}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={form.clientEmail}
                  onChange={set('clientEmail')}
                  placeholder="email@exemple.com"
                  className={cn(
                    fieldErrors.clientEmail && 'border-red-400 focus-visible:ring-red-400',
                  )}
                />
                {fieldErrors.clientEmail && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.clientEmail}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Un accès au portail client sera créé avec cet email.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Téléphone WhatsApp <span className="text-red-500">*</span>
                </label>
                <Input
                  type="tel"
                  value={form.clientPhone}
                  onChange={set('clientPhone')}
                  placeholder="+225 07 00 00 00 00"
                  className={cn(
                    fieldErrors.clientPhone && 'border-red-400 focus-visible:ring-red-400',
                  )}
                />
                {fieldErrors.clientPhone && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.clientPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* API error */}
          {mutation.isError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {(mutation.error as Error)?.message ??
                  'Une erreur est survenue. Veuillez réessayer.'}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending && <Spinner className="size-4" />}
            Confirmer la réservation
          </button>
        </form>

        {/* Summary */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Récapitulatif</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Terrain</span>
                <span className="max-w-45 truncate text-right font-medium text-gray-900">
                  {land.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Superficie</span>
                <span className="font-medium text-gray-900">
                  {land.sizeM2?.toLocaleString('fr-FR')} m²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Prix / m²</span>
                <span className="font-medium text-gray-900">{formatPrice(land.price)} F</span>
              </div>
              {acompte !== null && (
                <>
                  <div className="flex justify-between border-t border-gray-100 pt-3">
                    <span className="text-gray-500">Total estimé</span>
                    <span className="font-medium text-gray-900">
                      {formatPrice(land.price * land.sizeM2)} F
                    </span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span className="font-semibold">Acompte (5%)</span>
                    <span className="font-bold">{formatPrice(acompte)} F</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">À noter</p>
            <p className="mt-1">
              L&apos;acompte de 5% est dû à la confirmation. Le client recevra un email d&apos;accès
              au portail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
