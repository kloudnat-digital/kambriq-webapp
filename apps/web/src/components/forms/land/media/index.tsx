import { formatBytes } from '@/lib/utils';
import type { LandMediaFile, MediaFile } from '@/types/lands';
import { ImageIcon, PlayCircle, UploadCloud, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';

interface LandMediaProps {
  ref: React.RefObject<HTMLInputElement | null>;
  existingMedia: LandMediaFile[];
  mediaFiles: MediaFile[];
  setMediaFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
  deletingMediaId: string | null;
  handleDeleteExistingMedia: (id: string) => void;
  isSubmitting?: boolean;
}

const LandMediaFields: FC<LandMediaProps> = ({
  ref,
  existingMedia,
  mediaFiles,
  setMediaFiles,
  deletingMediaId,
  handleDeleteExistingMedia,
  isSubmitting,
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
          <p className="text-sm font-medium text-foreground">{t('form.mediaUploadLabel')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('form.mediaUploadHint')}</p>
        </div>
      </button>

      <input
        ref={ref}
        type="file"
        accept="image/jpeg/image/png,image/webp,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).map((file) => ({
            id: `${file.name}-${file.size}`,
            file,
            type: file.type.startsWith('video/') ? ('VIDEO' as const) : ('IMAGE' as const),
          }));
          setMediaFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            return [...prev, ...picked.filter((f) => !existingIds.has(f.id))];
          });
          e.target.value = '';
        }}
      />

      {existingMedia.length > 0 && (
        <div className="space-y-2">
          {existingMedia.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {item.type === 'VIDEO' ? (
                  <PlayCircle className="size-4" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.url.split('/').pop()}
                </p>
                <p className="text-xs text-muted-foreground">Uploaded</p>
              </div>
              <button
                type="button"
                disabled={deletingMediaId === item.id || isSubmitting}
                onClick={() => handleDeleteExistingMedia(item.id)}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mediaFiles.length > 0 && (
        <div className="space-y-2">
          {mediaFiles.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {item.type === 'VIDEO' ? (
                  <PlayCircle className="size-4" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setMediaFiles((prev) => prev.filter((f) => f.id !== item.id))}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default LandMediaFields;
