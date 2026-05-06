'use client';

import type { FC } from 'react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Land, LandLabel } from '@/types/lands';
import { CreateLandFormResolver } from '@/validations/schema/lands';
import type { CreateLandFormSchema } from '@/validations/schema/lands';
import { createLandAction, updateLandAction } from '@/lib/actions/lands';
import { CREATE_LAND_DEFAULTS } from '@/validations/schema/lands';
import { useLandUploads } from '@/hooks/use-land-uploads';
import { LandIdentityFields } from '@/components/forms/land/identity';
import { LandLocationFields } from '@/components/forms/land/location';
import { LandClassificationFields } from '@/components/forms/land/classification';
import { LandSurfacePriceFields } from '@/components/forms/land/surface-price';
import { LandPublishFields } from '@/components/forms/land/publish';
import LandMediaFields from '@/components/forms/land/media';
import LandDocumentFields from '@/components/forms/land/documents';

interface LandFormSheetProps {
  open: boolean;
  onClose: () => void;
  land?: Land | null;
  labels: LandLabel[];
  onSuccessAction?: () => void;
}

const LandFormSheet: FC<LandFormSheetProps> = ({
  open,
  onClose,
  land,
  onSuccessAction,
  labels,
}) => {
  const t = useTranslations('landsAdmin');
  const isEdit = !!land;

  const uploads = useLandUploads();
  const { init: initUploads } = uploads;

  const methods = useForm<CreateLandFormSchema>({
    resolver: zodResolver(CreateLandFormResolver),
    defaultValues: CREATE_LAND_DEFAULTS,
  });

  const {
    reset,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      if (land) {
        reset({
          title: land.title,
          description: land.description ?? '',
          region: land.region as CreateLandFormSchema['region'],
          city: land.city ?? '',
          neighborhood: land.neighborhood ?? '',
          latitude: land.latitude,
          longitude: land.longitude,
          sizeM2: land.sizeM2,
          price: land.price,
          labelId: land.label.id,
          pv: land.pv,
          ownerType: land.ownerType,
          titleNumber: land.titleNumber ?? '',
          isPublished: land.isPublished,
          isVerified: land.isVerified,
        });
      }
      initUploads(land);
    }
  }, [land, open, reset, initUploads]);

  const handleSubmit = async (data: CreateLandFormSchema) => {
    let landId: string;

    if (isEdit && land) {
      const result = await updateLandAction(land.id, data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      landId = land.id;
    } else {
      const result = await createLandAction(data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      landId = (result.data as { id: string }).id;
    }

    await uploads.uploadAll(landId);

    toast.success(isEdit ? t('form.updateSuccess') : t('form.createSuccess'));
    onSuccessAction?.();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col border-l-neutral-200/15 p-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-5">
          <SheetTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</SheetTitle>
          <SheetDescription>{isEdit ? t('form.editDesc') : t('form.createDesc')}</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={methods.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionIdentity')}
              </h3>
              <LandIdentityFields
                control={methods.control}
                isSubmitting={isSubmitting}
                fields={{
                  title: {
                    name: 'title',
                    label: t('form.title'),
                    placeholder: 'Ex: Terrain Bastos Nord',
                  },
                  description: {
                    name: 'description',
                    label: t('form.description'),
                    placeholder: t('form.descPlaceholder'),
                  },
                  region: {
                    name: 'region',
                    label: t('form.region'),
                    placeholder: t('form.selectRegion'),
                  },
                  city: {
                    name: 'city',
                    label: t('form.city'),
                    placeholder: t('form.cityPlaceholder'),
                  },
                  neighborhood: {
                    name: 'neighborhood',
                    label: t('form.neighborhood'),
                    placeholder: t('form.neighborhoodPlaceholder'),
                  },
                }}
              />
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionLocation')}
              </h3>
              <LandLocationFields
                control={methods.control}
                isSubmitting={isSubmitting}
                fields={{
                  latitude: {
                    name: 'latitude',
                    label: t('form.latitude'),
                    placeholder: t('form.latitudePlaceholder'),
                  },
                  longitude: {
                    name: 'longitude',
                    label: t('form.longitude'),
                    placeholder: t('form.longitudePlaceholder'),
                  },
                }}
              />
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionClassification')}
              </h3>
              <LandClassificationFields
                control={methods.control}
                isSubmitting={isSubmitting}
                fields={{
                  labelId: {
                    name: 'labelId',
                    label: t('form.label'),
                    placeholder: t('form.selectLabel'),
                  },
                  ownerType: {
                    name: 'ownerType',
                    label: t('form.ownerType'),
                    placeholder: t('form.selectOwnerType'),
                  },
                  titleNumber: {
                    name: 'titleNumber',
                    label: t('form.titleNumber'),
                    placeholder: 'TF/MFOUNDI/2024/0421',
                  },
                }}
                labels={labels}
              />
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionPricing')}
              </h3>

              <LandSurfacePriceFields
                control={methods.control}
                isSubmitting={isSubmitting}
                fields={{
                  sizeM2: {
                    name: 'sizeM2',
                    label: t('form.size'),
                    placeholder: 'Ex: 500',
                  },
                  price: {
                    name: 'price',
                    label: t('form.price'),
                    placeholder: 'Ex: 15000000',
                  },
                  pv: {
                    name: 'pv',
                    label: t('form.pv'),
                    placeholder: 'Ex: 1.0',
                  },
                }}
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionPublication')}
              </h3>

              <LandPublishFields
                control={methods.control}
                isSubmitting={isSubmitting}
                fields={{
                  isPublished: {
                    name: 'isPublished',
                    label: t('form.published'),
                  },
                  isVerified: {
                    name: 'isVerified',
                    label: t('form.verified'),
                  },
                }}
              />
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionMedia')}
              </h3>

              <LandMediaFields
                isSubmitting={isSubmitting}
                ref={uploads.mediaInputRef}
                mediaFiles={uploads.mediaFiles}
                setMediaFiles={uploads.setMediaFiles}
                existingMedia={uploads.existingMedia}
                deletingMediaId={uploads.deletingMediaId}
                handleDeleteExistingMedia={uploads.handleDeleteMedia}
              />
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('form.sectionDocuments')}
              </h3>

              <LandDocumentFields
                isSubmitting={isSubmitting}
                ref={uploads.docInputRef}
                existingDocs={uploads.existingDocs}
                deletingDocId={uploads.deletingDocId}
                documentFiles={uploads.documentFiles}
                setDocumentFiles={uploads.setDocumentFiles}
                handleDeleteExistingDocument={uploads.handleDeleteDocument}
              />
            </section>
          </div>

          <SheetFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('form.saving') : isEdit ? t('form.update') : t('form.create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default LandFormSheet;
