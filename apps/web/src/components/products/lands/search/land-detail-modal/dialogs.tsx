'use client';

import { useState } from 'react';
import { FileText, Eye } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatXAF } from '@/lib/money';
import type { MockLand } from '@/data/mock-lands';
import { DOCS } from './constants';

export type SubProps = {
  open: boolean;
  onClose: () => void;
  land: MockLand;
  t: ReturnType<typeof useTranslations<'landSearch'>>;
};

export function ProspectDialog({ open, onClose, land, t }: SubProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire to POST /lands/prospects
    toast.success(t('modal.actions.prospect.success'));
    onClose();
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modal.actions.prospect.title')}</DialogTitle>
          <DialogDescription>{land.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">{t('modal.actions.prospect.name')}</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-phone">{t('modal.actions.prospect.phone')}</Label>
            <Input
              id="p-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-email">{t('modal.actions.prospect.email')}</Label>
            <Input
              id="p-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-notes">{t('modal.actions.prospect.notes')}</Label>
            <Textarea
              id="p-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('modal.actions.cancel')}
            </Button>
            <Button type="submit">{t('modal.actions.prospect.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReservationDialog({ open, onClose, land, t }: SubProps) {
  const deposit = Math.round(land.price * 0.05);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState(String(deposit));
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire to POST /lands/reservations
    toast.success(t('modal.actions.reservation.success'));
    onClose();
    setName('');
    setPhone('');
    setNotes('');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modal.actions.reservation.title')}</DialogTitle>
          <DialogDescription>
            {land.title} - {formatXAF(land.price)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="r-name">{t('modal.actions.reservation.clientName')}</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-phone">{t('modal.actions.reservation.clientPhone')}</Label>
            <Input
              id="r-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-deposit">{t('modal.actions.reservation.deposit')} (XAF)</Label>
            <Input
              id="r-deposit"
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-notes">{t('modal.actions.reservation.notes')}</Label>
            <Textarea
              id="r-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('modal.actions.cancel')}
            </Button>
            <Button type="submit">{t('modal.actions.reservation.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocsDialog({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<'landSearch'>>;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modal.actions.docs.title')}</DialogTitle>
          <DialogDescription>{t('modal.actions.docs.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {DOCS.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 shrink-0 text-primary-600" />
                <span className="text-sm font-medium text-gray-800">{t(key)}</span>
              </div>
              <Button size="sm" variant="ghost" className="gap-1.5">
                <Eye className="size-3.5" />
                {t('modal.actions.docs.view')}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('modal.actions.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SupportDialog({ open, onClose, land, t }: SubProps) {
  const [type, setType] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire to POST /support/requests
    toast.success(t('modal.actions.support.success'), {
      description: t('modal.actions.support.successDesc'),
    });
    onClose();
    setType('');
    setMessage('');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modal.actions.support.title')}</DialogTitle>
          <DialogDescription>{land.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('modal.actions.support.requestType')}</Label>
            <Select value={type} onValueChange={setType} required>
              <SelectTrigger>
                <SelectValue placeholder={t('modal.actions.support.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(['legal', 'commercial', 'client', 'other'] as const).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`modal.actions.support.types.${k}` as 'modal.actions.support.types.legal')}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-message">{t('modal.actions.support.message')}</Label>
            <Textarea
              id="s-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('modal.actions.support.messagePlaceholder')}
              rows={4}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('modal.actions.cancel')}
            </Button>
            <Button type="submit">{t('modal.actions.support.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
