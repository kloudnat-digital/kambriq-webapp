'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImageIcon, PlayCircle, UploadCloud, X } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminLand, LandLabel, LandFormValues } from './types';

type LandFormSheetProps = {
  open: boolean;
  onClose: () => void;
  land?: AdminLand | null;
  labels: LandLabel[];
  onSave: (values: LandFormValues) => void;
};

const CAMEROON_REGIONS = [
  'Adamaoua',
  'Centre',
  'Est',
  'Extrême-Nord',
  'Littoral',
  'Nord',
  'Nord-Ouest',
  'Ouest',
  'Sud',
  'Sud-Ouest',
];

const DEFAULT_VALUES: LandFormValues = {
  title: '',
  description: '',
  region: '',
  city: '',
  neighborhood: '',
  sizeM2: 0,
  price: 0,
  labelId: '',
  pv: 1.0,
  ownerType: 'KAMBRIQ',
  titleNumber: '',
  isPublished: false,
  isVerified: false,
};

type MediaFile = {
  id: string;
  file: File;
  type: 'image' | 'video';
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function LandFormSheet({ open, onClose, land, labels, onSave }: LandFormSheetProps) {
  const t = useTranslations('landsAdmin');
  const isEdit = !!land;
  const [values, setValues] = useState<LandFormValues>(DEFAULT_VALUES);
  const [saving, setSaving] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (land) {
      setValues({
        title: land.title,
        description: '',
        region: land.region,
        city: land.city ?? '',
        neighborhood: land.neighborhood ?? '',
        sizeM2: land.sizeM2,
        price: land.price,
        labelId: land.label.id,
        pv: land.pv,
        ownerType: land.ownerType,
        titleNumber: land.titleNumber ?? '',
        isPublished: land.isPublished,
        isVerified: land.isVerified,
      });
    } else {
      setValues(DEFAULT_VALUES);
    }
  }, [land, open]);

  function set<K extends keyof LandFormValues>(key: K, val: LandFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !values.title ||
      !values.region ||
      !values.labelId ||
      values.sizeM2 <= 0 ||
      values.price <= 0
    ) {
      toast.error(t('form.errorRequired'));
      return;
    }
    setSaving(true);
    // TODO: wire to POST/PATCH /lands/admin
    await new Promise((r) => setTimeout(r, 600));
    onSave(values);
    toast.success(isEdit ? t('form.updateSuccess') : t('form.createSuccess'));
    setSaving(false);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col border-l-neutral-200/15 p-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-5">
          <SheetTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</SheetTitle>
          <SheetDescription>{isEdit ? t('form.editDesc') : t('form.createDesc')}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {/* Identité */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionIdentity')}
              </h3>
              <div className="space-y-1.5">
                <Label htmlFor="f-title">{t('form.title')} *</Label>
                <Input
                  id="f-title"
                  value={values.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="Ex: Terrain Bastos Nord"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-desc">{t('form.description')} *</Label>
                <Textarea
                  id="f-desc"
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  placeholder={t('form.descPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('form.region')} *</Label>
                <Select value={values.region} onValueChange={(v) => set('region', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('form.selectRegion')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMEROON_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-city">{t('form.city')}</Label>
                <Input
                  id="f-city"
                  value={values.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-neighborhood">{t('form.neighborhood')}</Label>
                <Input
                  id="f-neighborhood"
                  value={values.neighborhood}
                  onChange={(e) => set('neighborhood', e.target.value)}
                />
              </div>
            </section>

            <Separator />

            {/* Classification */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionClassification')}
              </h3>
              <div className="space-y-1.5">
                <Label>{t('form.label')} *</Label>
                <Select value={values.labelId} onValueChange={(v) => set('labelId', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('form.selectLabel')} />
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
              </div>
              <div className="space-y-1.5">
                <Label>{t('form.ownerType')}</Label>
                <Select
                  value={values.ownerType}
                  onValueChange={(v) => set('ownerType', v as 'KAMBRIQ' | 'PARTNER')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KAMBRIQ">KAMBRIQ</SelectItem>
                    <SelectItem value="PARTNER">{t('form.partner')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-tf">{t('form.titleNumber')}</Label>
                <Input
                  id="f-tf"
                  value={values.titleNumber}
                  onChange={(e) => set('titleNumber', e.target.value)}
                  placeholder="TF/MFOUNDI/2024/0421"
                  className="font-mono"
                />
              </div>
            </section>

            <Separator />

            {/* Superficie & Prix */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionPricing')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="f-size">{t('form.size')} (m²) *</Label>
                  <Input
                    id="f-size"
                    type="number"
                    min={1}
                    value={values.sizeM2 || ''}
                    onChange={(e) => set('sizeM2', parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f-price">{t('form.price')} (XAF) *</Label>
                  <Input
                    id="f-price"
                    type="number"
                    min={1}
                    value={values.price || ''}
                    onChange={(e) => set('price', parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-pv">
                  {t('form.pv')} <span className="text-xs text-muted-foreground">(0.1 - 2.0)</span>
                </Label>
                <Input
                  id="f-pv"
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={2.0}
                  value={values.pv}
                  onChange={(e) => set('pv', parseFloat(e.target.value) || 1.0)}
                />
              </div>
            </section>

            <Separator />

            {/* Publication */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionPublication')}
              </h3>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="f-published"
                  checked={values.isPublished}
                  onCheckedChange={(c) => set('isPublished', !!c)}
                />
                <Label htmlFor="f-published" className="cursor-pointer font-normal">
                  {t('form.published')}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="f-verified"
                  checked={values.isVerified}
                  onCheckedChange={(c) => set('isVerified', !!c)}
                />
                <Label htmlFor="f-verified" className="cursor-pointer font-normal">
                  {t('form.verified')}
                </Label>
              </div>
            </section>

            <Separator />

            {/* Médias */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionMedia')}
              </h3>

              {/* Drop zone */}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-500/5"
              >
                <UploadCloud className="size-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('form.mediaUploadLabel')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('form.mediaUploadHint')}
                  </p>
                </div>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []).map((file) => ({
                    id: `${file.name}-${file.size}`,
                    file,
                    type: file.type.startsWith('video/') ? ('video' as const) : ('image' as const),
                  }));
                  setMediaFiles((prev) => {
                    const existingIds = new Set(prev.map((f) => f.id));
                    return [...prev, ...picked.filter((f) => !existingIds.has(f.id))];
                  });
                  e.target.value = '';
                }}
              />

              {/* File list */}
              {mediaFiles.length > 0 && (
                <div className="space-y-2">
                  {mediaFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {item.type === 'video' ? (
                          <PlayCircle className="size-4" />
                        ) : (
                          <ImageIcon className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(item.file.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setMediaFiles((prev) => prev.filter((f) => f.id !== item.id))
                        }
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <SheetFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('form.saving') : isEdit ? t('form.update') : t('form.create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
