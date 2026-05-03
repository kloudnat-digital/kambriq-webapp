type DocumentMetaProps = {
  version: string;
  effectiveDate: string;
  docId?: string;
};

export function DocumentMeta({ version, effectiveDate, docId }: DocumentMetaProps) {
  const parts = [`Version ${version}`, `En vigueur depuis le ${effectiveDate}`];
  if (docId) parts.push(`Référence ${docId}`);

  return (
    <p className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500">{parts.join(' · ')}</p>
  );
}
