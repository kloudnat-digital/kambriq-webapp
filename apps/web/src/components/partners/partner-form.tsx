'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PARTNER_TYPES = ['notary', 'surveyor', 'bank', 'university', 'real_estate', 'other'];

export const PartnerForm = () => {
  const t = useTranslations('partners.form');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success(t('success'));
    setSending(false);
  };

  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-2 text-center text-2xl font-bold">{t('title')}</h2>
        <p className="mb-10 text-center text-sm text-gray-500">{t('subtitle')}</p>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border bg-white p-8 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('company')} *</Label>
              <Input placeholder="Kambriq Partner Ltd" required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('name')} *</Label>
              <Input placeholder="Jean Dupont" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('email')} *</Label>
              <Input type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('phone')}</Label>
              <Input type="tel" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('partnerType')} *</Label>
            <Select required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectType')} />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_TYPES.map((pt) => (
                  <SelectItem key={pt} value={pt}>
                    {t(`types.${pt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('message')}</Label>
            <Textarea rows={4} placeholder={t('messagePlaceholder')} />
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? t('sending') : t('submit')}
          </Button>
        </form>
      </div>
    </section>
  );
};
