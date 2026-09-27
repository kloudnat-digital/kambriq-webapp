/** Sends a file to a presigned PUT URL. Throws on any non-2xx answer. */
export const uploadToS3 = async (uploadUrl: string, file: File): Promise<void> => {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
};
