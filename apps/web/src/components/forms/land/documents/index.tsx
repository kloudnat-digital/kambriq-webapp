'use client';

import { FileText, Lock, Unlock, UploadCloud, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';
import { formatBytes } from '@/lib/utils';
import type { DocumentFile, LandDocument, LandDocumentType } from '@/types/lands';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const DOC_TYPES: LandDocumentType[] = ['TITLE_DEED', 'SURVEY', 'PERMIT', 'RECEIPT', 'OTHER'];

interface LandDocumentProps {
  ref: React.RefObject<HTMLInputElement | null>;
  existingDocs: LandDocument[];
  documentFiles: DocumentFile[];
  setDocumentFiles: React.Dispatch<React.SetStateAction<DocumentFile[]>>;
  deletingDocId: string | null;
  handleDeleteExistingDocument: (id: string) => void;
  isSubmitting?: boolean;
}

const LandDocumentFields: FC<LandDocumentProps> = ({
  ref,
  isSubmitting,
  existingDocs,
  documentFiles,
  deletingDocId,
  setDocumentFiles,
  handleDeleteExistingDocument,
}) => {
  const t = useTranslations('landsAdmin');

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={isSubmitting}
        className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-500/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">{t('form.docUploadLabel')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('form.docUploadHint')}</p>
        </div>
      </button>

      <input
        ref={ref}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).map((file) => ({
            id: `${file.name}-${file.size}`,
            file,
            docType: 'OTHER' as LandDocumentType,
            isPrivate: true,
          }));
          setDocumentFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            return [...prev, ...picked.filter((f) => !existingIds.has(f.id))];
          });
          e.target.value = '';
        }}
      />

      {existingDocs.length > 0 && (
        <div className="space-y-2">
          {existingDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`form.docTypes.${doc.type}` as 'form.docTypes.OTHER')}
                </p>
              </div>
              {doc.isPrivate ? (
                <Lock className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Unlock className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <button
                type="button"
                disabled={deletingDocId === doc.id || isSubmitting}
                onClick={() => handleDeleteExistingDocument(doc.id)}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {documentFiles.length > 0 && (
        <div className="space-y-2">
          {documentFiles.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(doc.file.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setDocumentFiles((prev) => prev.filter((f) => f.id !== doc.id))}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 pl-11">
                <Select
                  value={doc.docType}
                  onValueChange={(value) =>
                    setDocumentFiles((prev) =>
                      prev.map((f) =>
                        f.id === doc.id ? { ...f, docType: value as LandDocumentType } : f,
                      ),
                    )
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-7! w-full rounded-sm px-2 py-1 text-xs">
                    <SelectValue placeholder={t('form.docTypes.TITLE_DEED')} />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`form.docTypes.${type}` as 'form.docTypes.OTHER')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    id={`is-private-doc-${doc.id}`}
                    checked={doc.isPrivate}
                    onCheckedChange={(checked) =>
                      setDocumentFiles((prev) =>
                        prev.map((f) =>
                          f.id === doc.id ? { ...f, isPrivate: checked as boolean } : f,
                        ),
                      )
                    }
                    disabled={isSubmitting}
                  />
                  <Label
                    htmlFor={`is-private-doc-${doc.id}`}
                    className="cursor-pointer text-muted-foreground"
                  >
                    {t('form.docPrivate')}
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default LandDocumentFields;
