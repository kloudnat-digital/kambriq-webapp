'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import { getAvatarUploadUrl, updateMe } from '@/lib/actions/account';
import { getInitials } from '@/lib/user';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface AvatarUploaderProps {
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
}

export const AvatarUploader = ({ avatarUrl, firstName, lastName }: AvatarUploaderProps) => {
  const t = useTranslations('app.account.profile');
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const { createToast } = useToastStore();
  const [uploading, setUploading] = useState(false);

  const handleClick = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      createToast({ status: 'error', title: t('avatarInvalidType') });
      return;
    }
    if (file.size > MAX_BYTES) {
      createToast({ status: 'error', title: t('avatarFileTooLarge') });
      return;
    }

    setUploading(true);
    try {
      const urlResult = await getAvatarUploadUrl({
        filename: file.name,
        contentType: file.type,
      });
      if (!urlResult.success) {
        createToast({ status: 'error', title: urlResult.error });
        return;
      }

      const { uploadUrl, fileUrl } = urlResult.data;
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) {
        createToast({ status: 'error', title: t('avatarUploadError') });
        return;
      }

      const patchResult = await updateMe({ avatarUrl: fileUrl }, pathname);
      if (!patchResult.success) {
        createToast({ status: 'error', title: patchResult.error });
        return;
      }

      createToast({ status: 'success', title: t('avatarUploaded') });
    } catch {
      createToast({ status: 'error', title: t('avatarUploadError') });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg" className="size-16">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
          {getInitials(firstName, lastName)}
        </AvatarFallback>
      </Avatar>
      <div>
        <Button type="button" variant="outline" onClick={handleClick} disabled={uploading}>
          {uploading ? <Spinner className="size-4" /> : <Camera className="size-4" />}
          {uploading ? t('uploadingAvatar') : t('changeAvatar')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
};
