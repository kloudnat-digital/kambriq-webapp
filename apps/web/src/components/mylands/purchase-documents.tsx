import { FileText, Download } from 'lucide-react';

interface PurchaseDocumentsProps {
  documents: Array<{ id: string; name: string; type: string; url: string }>;
}

export function PurchaseDocuments({ documents }: PurchaseDocumentsProps) {
  if (documents.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Documents fournis par KAMBRIQ</h2>
      <ul className="divide-y divide-gray-100">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-4 shrink-0 text-gray-400" />
              <span className="truncate text-sm text-gray-700">{doc.name}</span>
            </div>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Download className="size-3.5" />
              Télécharger
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
