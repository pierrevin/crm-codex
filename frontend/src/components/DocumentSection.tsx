import { FolderIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface DocumentSectionProps {
  driveFolderId?: string;
  quoteUrl?: string;
  invoiceUrls?: string[];
}

export function DocumentSection({
  driveFolderId,
  quoteUrl,
  invoiceUrls = []
}: DocumentSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Documents</h2>
      
      <div className="space-y-2">
        {/* Dossier Google Drive */}
        {driveFolderId ? (
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 transition-all hover:border-green-300 hover:bg-green-100"
          >
            <FolderIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-medium text-green-900 flex-1">Dossier Drive</span>
            <span className="text-xs text-green-600">Voir tous les documents</span>
          </a>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <FolderIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-500">Dossier Drive (création en cours...)</span>
          </div>
        )}

        {/* Dernier devis */}
        {quoteUrl && (
          <a
            href={quoteUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 transition-all hover:border-indigo-300 hover:bg-indigo-100"
          >
            <DocumentTextIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
            <span className="text-sm font-medium text-indigo-900 flex-1">Dernier devis</span>
          </a>
        )}

        {/* Factures Tiime */}
        {invoiceUrls && invoiceUrls.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-3 mb-2">
              <DocumentTextIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-medium text-amber-900">
                {invoiceUrls.length} facture(s) Tiime
              </span>
            </div>
            <div className="ml-8 space-y-1">
              {invoiceUrls.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-amber-700 hover:text-amber-900 transition-colors"
                >
                  → Facture {index + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Derniers documents du Drive */}
        {driveFolderId && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <a
              href={`https://drive.google.com/drive/folders/${driveFolderId}`}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              📁 Voir tous les documents du dossier
            </a>
          </div>
        )}
      </div>

      {!driveFolderId && !quoteUrl && (!invoiceUrls || invoiceUrls.length === 0) && (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-500">Aucun document disponible</p>
        </div>
      )}
    </div>
  );
}

