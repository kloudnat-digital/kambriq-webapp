'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  getLandUploadUrl,
  addMediaAction,
  deleteMediaAction,
  addDocumentAction,
  deleteDocumentAction,
} from '@/lib/actions/lands';
import type { DocumentFile, Land, LandDocument, MediaFile } from '@/types/lands';

type ExistingMedia = Land['media'][number];

export function useLandUploads() {
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [existingMedia, setExistingMedia] = useState<ExistingMedia[]>([]);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);

  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([]);
  const [existingDocs, setExistingDocs] = useState<LandDocument[]>([]);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const init = useCallback((land?: Land | null) => {
    setMediaFiles([]);
    setExistingMedia(land?.media ?? []);
    setDocumentFiles([]);
    setExistingDocs(land?.documents ?? []);
  }, []);

  const handleDeleteMedia = async (mediaId: string) => {
    setDeletingMediaId(mediaId);
    const result = await deleteMediaAction(mediaId);
    setDeletingMediaId(null);
    if (result.success) {
      setExistingMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingDocId(docId);
    const result = await deleteDocumentAction(docId);
    setDeletingDocId(null);
    if (result.success) {
      setExistingDocs((prev) => prev.filter((d) => d.id !== docId));
    } else {
      toast.error(result.error);
    }
  };

  const uploadAll = async (landId: string) => {
    for (const mediaFile of mediaFiles) {
      const urlResult = await getLandUploadUrl(
        landId,
        { filename: mediaFile.file.name, contentType: mediaFile.file.type },
        'MEDIA',
      );

      if (!urlResult.success) {
        toast.error(urlResult.error ?? `Failed to get upload URL for ${mediaFile.file.name}`);
        continue;
      }

      const { uploadUrl, fileUrl } = urlResult.data;

      try {
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          body: mediaFile.file,
          headers: { 'Content-Type': mediaFile.file.type },
        });

        if (!res.ok) {
          toast.error(`Upload failed (${res.status}) for ${mediaFile.file.name}`);
          continue;
        }

        await addMediaAction({ landId, type: mediaFile.type, url: fileUrl });
      } catch (err) {
        toast.error(
          `Upload error for ${mediaFile.file.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    for (const docFile of documentFiles) {
      const urlResult = await getLandUploadUrl(
        landId,
        { filename: docFile.file.name, contentType: docFile.file.type },
        'DOCUMENT',
      );

      if (!urlResult.success) {
        toast.error(urlResult.error ?? `Failed to get upload URL for ${docFile.file.name}`);
        continue;
      }

      const { uploadUrl, fileUrl } = urlResult.data;

      try {
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          body: docFile.file,
          headers: { 'Content-Type': docFile.file.type },
        });

        if (!res.ok) {
          toast.error(`Upload failed (${res.status}) for ${docFile.file.name}`);
          continue;
        }

        await addDocumentAction({
          landId,
          type: docFile.docType,
          name: docFile.file.name,
          url: fileUrl,
          isPrivate: docFile.isPrivate,
        });
      } catch (err) {
        toast.error(
          `Upload error for ${docFile.file.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };

  return {
    mediaInputRef,
    docInputRef,
    mediaFiles,
    setMediaFiles,
    existingMedia,
    deletingMediaId,
    handleDeleteMedia,
    documentFiles,
    setDocumentFiles,
    existingDocs,
    deletingDocId,
    handleDeleteDocument,
    init,
    uploadAll,
  };
}
