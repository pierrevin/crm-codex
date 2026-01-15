import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DocumentTextIcon,
  ReceiptRefundIcon,
  ChevronDownIcon, 
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { Payment } from '../services/paymentService';
import { DeboursNote } from '../services/deboursNoteService';

interface Quote {
  id: string;
  label: string;
  quoteNumber?: string;
  totalTTC?: string | number;
  status: string;
  issueDate: string;
  opportunityId?: string;
  opportunity?: {
    id: string;
    title: string;
  };
}

interface CompanyDocumentsTableProps {
  quotes: Quote[];
  invoiceUrls: Array<{ url: string; opportunityId?: string; opportunity?: { id: string; title: string; amount?: number } }>;
  deboursNotes: DeboursNote[];
  payments: Payment[];
  opportunities?: Array<{ id: string; title: string; amount?: number }>; // Pour récupérer les montants des opportunités
  onEditDeboursNote?: (note: DeboursNote) => void;
  onDeleteDeboursNote?: (noteId: string) => void;
  onCreateDeboursNote?: (opportunityId: string) => void;
}

interface DocumentItem {
  id: string;
  type: 'QUOTE' | 'INVOICE' | 'DEBOURS_NOTE';
  title: string;
  amount: number;
  date: string;
  url?: string;
  status?: string;
  deboursNoteId?: string;
  quoteId?: string;
  opportunityId?: string;
  opportunityTitle?: string;
  payments: Payment[];
}

export function CompanyDocumentsTable({
  quotes,
  invoiceUrls,
  deboursNotes,
  payments,
  opportunities = [],
  onEditDeboursNote,
  onDeleteDeboursNote,
  onCreateDeboursNote
}: CompanyDocumentsTableProps) {
  const navigate = useNavigate();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterOpportunityId, setFilterOpportunityId] = useState<string | null>(null);

  // Construire les items de documents
  const buildDocumentItems = (): DocumentItem[] => {
    const items: DocumentItem[] = [];

    // Ajouter les devis
    quotes.forEach(quote => {
      const quotePayments = payments.filter(p => !p.deboursNoteId && p.opportunityId === quote.opportunityId);
      items.push({
        id: `quote-${quote.id}`,
        type: 'QUOTE',
        title: quote.label || `Devis ${quote.quoteNumber || ''}`,
        amount: quote.totalTTC ? parseFloat(quote.totalTTC.toString()) : 0,
        date: quote.issueDate,
        status: quote.status,
        quoteId: quote.id,
        opportunityId: quote.opportunityId || quote.opportunity?.id,
        opportunityTitle: quote.opportunity?.title,
        payments: quotePayments
      });
    });

    // Ajouter les factures Tiime
    invoiceUrls.forEach((invoice, index) => {
      const invoicePayments = payments.filter(p => !p.deboursNoteId && p.opportunityId === invoice.opportunityId);
      const oppId = invoice.opportunityId || invoice.opportunity?.id;
      const relatedOpp = opportunities.find(o => o.id === oppId);
      const invoiceAmount = invoice.opportunity?.amount || relatedOpp?.amount || 0;
      items.push({
        id: `invoice-${index}-${oppId || 'no-opp'}`,
        type: 'INVOICE',
        title: `Facture Tiime ${index + 1}`,
        amount: typeof invoiceAmount === 'string' ? parseFloat(invoiceAmount) : (invoiceAmount || 0),
        date: new Date().toISOString(),
        url: invoice.url,
        opportunityId: oppId,
        opportunityTitle: invoice.opportunity?.title || relatedOpp?.title,
        payments: invoicePayments
      });
    });

    // Ajouter les notes de débours
    deboursNotes.forEach(note => {
      const notePayments = payments.filter(p => p.deboursNoteId === note.id);
      items.push({
        id: `debours-${note.id}`,
        type: 'DEBOURS_NOTE',
        title: note.title,
        amount: parseFloat(note.totalAmount.toString()),
        date: note.issueDate,
        status: note.status,
        deboursNoteId: note.id,
        url: note.googleDocUrl,
        opportunityId: note.opportunityId,
        opportunityTitle: (note as any).opportunity?.title,
        payments: notePayments
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const allDocumentItems = buildDocumentItems();
  
  // Filtrer par opportunité si sélectionnée
  const filteredDocumentItems = useMemo(() => {
    if (!filterOpportunityId) return allDocumentItems;
    return allDocumentItems.filter(item => item.opportunityId === filterOpportunityId);
  }, [allDocumentItems, filterOpportunityId]);

  // Récupérer la liste unique des opportunités pour le filtre
  const uniqueOpportunities = useMemo(() => {
    const oppsMap = new Map<string, { id: string; title: string }>();
    allDocumentItems.forEach(item => {
      if (item.opportunityId && item.opportunityTitle) {
        oppsMap.set(item.opportunityId, { id: item.opportunityId, title: item.opportunityTitle });
      }
    });
    return Array.from(oppsMap.values());
  }, [allDocumentItems]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getTotalPaid = (payments: Payment[]): number => {
    return payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  };

  const getRemainingAmount = (item: DocumentItem): number => {
    const totalPaid = getTotalPaid(item.payments);
    return Math.max(0, item.amount - totalPaid);
  };

  const getQuoteStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      'DRAFT': { label: 'Brouillon', class: 'bg-slate-100 text-slate-700' },
      'SENT': { label: 'Envoyé', class: 'bg-blue-100 text-blue-700' },
      'ACCEPTED': { label: 'Accepté', class: 'bg-green-100 text-green-700' },
      'REJECTED': { label: 'Refusé', class: 'bg-red-100 text-red-700' },
      'EXPIRED': { label: 'Expiré', class: 'bg-amber-100 text-amber-700' }
    };
    const statusInfo = statusMap[status] || { label: status, class: 'bg-slate-100 text-slate-700' };
    return <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.class}`}>{statusInfo.label}</span>;
  };

  const getStatusBadge = (item: DocumentItem) => {
    if (item.type === 'QUOTE' && item.status) {
      return getQuoteStatusBadge(item.status);
    }
    
    const remaining = getRemainingAmount(item);
    const totalPaid = getTotalPaid(item.payments);

    if (remaining === 0 && totalPaid > 0) {
      return <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Payé</span>;
    } else if (totalPaid > 0) {
      return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">Partiel</span>;
    } else {
      return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Non payé</span>;
    }
  };

  const getTypeIcon = (type: DocumentItem['type']) => {
    switch (type) {
      case 'QUOTE':
        return <DocumentTextIcon className="h-5 w-5 text-indigo-600" />;
      case 'INVOICE':
        return <DocumentTextIcon className="h-5 w-5 text-amber-600" />;
      case 'DEBOURS_NOTE':
        return <ReceiptRefundIcon className="h-5 w-5 text-purple-600" />;
    }
  };

  const getTypeLabel = (type: DocumentItem['type']) => {
    switch (type) {
      case 'QUOTE':
        return 'Devis';
      case 'INVOICE':
        return 'Facture';
      case 'DEBOURS_NOTE':
        return 'Note de débours';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Documents</h2>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtre par opportunité */}
          {uniqueOpportunities.length > 0 && (
            <select
              value={filterOpportunityId || ''}
              onChange={(e) => setFilterOpportunityId(e.target.value || null)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Toutes les opportunités</option>
              {uniqueOpportunities.map(opp => (
                <option key={opp.id} value={opp.id}>{opp.title}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filteredDocumentItems.length === 0 ? (
        <div className="py-12 text-center">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-4 text-sm text-slate-500">Aucun document</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Opportunité</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Montant TTC</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Payé</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Reste dû</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDocumentItems.map((item) => {
                const isExpanded = expandedRows.has(item.id);
                const totalPaid = getTotalPaid(item.payments);
                const remaining = getRemainingAmount(item);

                return (
                  <>
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-2 py-2">
                        {item.payments.length > 0 && (
                          <button
                            onClick={() => toggleRow(item.id)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </td>
                      <td 
                        className={`px-2 py-2 transition-colors ${
                          (item.type === 'QUOTE' && item.quoteId) || (item.type === 'DEBOURS_NOTE' && item.deboursNoteId && onEditDeboursNote)
                            ? 'cursor-pointer hover:bg-slate-100' 
                            : ''
                        }`}
                        onClick={() => {
                          if (item.type === 'QUOTE' && item.quoteId) {
                            navigate(`/quotes/${item.quoteId}${item.opportunityId ? `?opportunityId=${item.opportunityId}` : ''}`);
                          } else if (item.type === 'DEBOURS_NOTE' && item.deboursNoteId && onEditDeboursNote) {
                            const note = deboursNotes.find(n => n.id === item.deboursNoteId);
                            if (note) onEditDeboursNote(note);
                          }
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {getTypeIcon(item.type)}
                            <span className={`text-xs transition-colors ${
                              (item.type === 'QUOTE' && item.quoteId) || (item.type === 'DEBOURS_NOTE' && item.deboursNoteId && onEditDeboursNote)
                                ? 'text-indigo-600 hover:text-indigo-700 font-medium' 
                                : 'text-slate-600'
                            }`}>
                              {getTypeLabel(item.type)}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 pl-6">
                            {formatDate(item.date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {item.opportunityId && item.opportunityTitle ? (
                          <button
                            onClick={() => navigate(`/opportunites/${item.opportunityId}`)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            {item.opportunityTitle}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-semibold text-slate-900">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-slate-600">
                        {formatCurrency(totalPaid)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-semibold text-slate-900">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {getStatusBadge(item)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          {item.type === 'QUOTE' && item.quoteId ? (
                            <button
                              onClick={() => navigate(`/quotes/${item.quoteId}${item.opportunityId ? `?opportunityId=${item.opportunityId}` : ''}`)}
                              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                            >
                              <PencilIcon className="h-3 w-3" />
                              Éditer
                            </button>
                          ) : item.type === 'DEBOURS_NOTE' && item.deboursNoteId ? (
                            <>
                              {item.url && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.url, '_blank', 'noopener,noreferrer');
                                  }}
                                  className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                  title="Ouvrir le document Google Docs"
                                >
                                  <DocumentTextIcon className="h-3 w-3" />
                                </button>
                              )}
                              {onEditDeboursNote && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const note = deboursNotes.find(n => n.id === item.deboursNoteId);
                                    if (note) onEditDeboursNote(note);
                                  }}
                                  className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                  Éditer
                                </button>
                              )}
                              {onDeleteDeboursNote && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette note de débours ?\n\nLa note et le document Google Docs associé seront définitivement supprimés.')) {
                                      onDeleteDeboursNote(item.deboursNoteId!);
                                    }
                                  }}
                                  className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                                  title="Supprimer la note de débours"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </button>
                              )}
                            </>
                          ) : item.type === 'INVOICE' && item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                              title="Ouvrir la facture"
                            >
                              <DocumentTextIcon className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {/* Lignes de paiements expansibles */}
                    {isExpanded && item.payments.length > 0 && (
                      <>
                        {item.payments.map((payment) => (
                          <tr 
                            key={payment.id} 
                            className="bg-slate-50 hover:bg-slate-100"
                          >
                            <td></td>
                            <td 
                              className="px-2 py-1.5 pl-8 cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5">
                                <BanknotesIcon className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs text-slate-600">Paiement</span>
                                <span className="text-xs text-slate-500 pl-6">
                                  {formatDate(payment.paymentDate)}
                                </span>
                              </div>
                            </td>
                            <td></td>
                            <td></td>
                            <td 
                              className="px-2 py-1.5 text-right text-xs font-medium text-slate-900"
                            >
                              {formatCurrency(parseFloat(payment.amount.toString()))}
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


