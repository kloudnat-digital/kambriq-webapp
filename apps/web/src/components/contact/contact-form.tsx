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

const SUBJECTS = ['lands', 'verify', 'kamnet', 'kbs', 'partnership', 'other'] as const;

export const ContactForm = () => {
  const t = useTranslations('contact.form');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success(t('successMessage'));
    (e.target as HTMLFormElement).reset();
    setSending(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold text-gray-900">{t('title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">{t('name')} *</Label>
            <Input id="c-name" placeholder="Jean Dupont" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">{t('email')} *</Label>
            <Input id="c-email" type="email" placeholder="jean@example.com" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-phone">{t('phone')}</Label>
          <Input id="c-phone" type="tel" placeholder="+237 6 XX XX XX XX" />
        </div>
        <div className="space-y-1.5">
          <Label>{t('subject')} *</Label>
          <Select required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectSubject')} />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`subjects.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-message">{t('message')} *</Label>
          <Textarea id="c-message" rows={5} placeholder={t('messagePlaceholder')} required />
        </div>
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? t('sending') : t('send')}
        </Button>
      </form>
    </div>
  );
};
