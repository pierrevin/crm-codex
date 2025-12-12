import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDownIcon, 
  ChevronRightIcon, 
  PlusIcon,
  DocumentTextIcon,
  ReceiptRefundIcon,
  BanknotesIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { Payment, paymentService } from '../services/paymentService';
import { DeboursNote } from '../services/deboursNoteService';
import { PaymentModal } from './PaymentModal';

interface Quote {
  id: string;
  label: string;
  quoteNumber?: string;
  totalTTC?: string;
  status: string;
  issueDate: string;
}

interface RevenueItem {
  id: string;
  type: 'QUOTE' | 'INVOICE' | 'DEBOURS_NOTE';
  title: string;
  amount: number;
  date: string;
  url?: string;
  status?: string;
  deboursNoteId?: string;
  quoteId?: string; // ID du devis pour navigation
  payments: Payment[];
}

interface RevenueTableProps {
  quotes: Quote[];
  invoiceUrls: string[];
  deboursNotes: DeboursNote[];
  payments: Payment[];
  opportunityId: string;
  opportunityTitle: string;
  opportunityAmount?: number;
  opportunityTaxRate?: number;
  onRefresh: () => void;
  onCreateQuote?: () => void;
  onCreateDeboursNote?: () => void;
  onEditDeboursNote?: (note: DeboursNote) => void;
  onDeleteDeboursNote?: (noteId: string) => void;
}

export function RevenueTable({
  quotes,
  invoiceUrls,
  deboursNotes,
  payments,
  opportunityId,
  opportunityTitle,
  opportunityAmount,
  opportunityTaxRate,
  onRefresh,
  onCreateQuote,
  onCreateDeboursNote,
  onEditDeboursNote,
  onDeleteDeboursNote
}: RevenueTableProps) {
  const navigate = useNavigate();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRevenueItem, setSelectedRevenueItem] = useState<RevenueItem | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null); // Pour édition

  // Construire les items de recette
  const buildRevenueItems = (): RevenueItem[] => {
    const items: RevenueItem[] = [];

    // Ajouter les devis
    quotes.forEach(quote => {
      const quotePayments = payments.filter(p => !p.deboursNoteId);
      items.push({
        id: `quote-${quote.id}`,
        type: 'QUOTE',
        title: quote.label || `Devis ${quote.quoteNumber || ''}`,
        amount: quote.totalTTC ? parseFloat(quote.totalTTC) : 0,
        date: quote.issueDate,
        status: quote.status,
        quoteId: quote.id, // Stocker l'ID du devis pour navigation
        payments: quotePayments
      });
    });

    // Ajouter les factures Tiime
    invoiceUrls.forEach((url, index) => {
      const invoicePayments = payments.filter(p => !p.deboursNoteId);
      items.push({
        id: `invoice-${index}`,
        type: 'INVOICE',
        title: `Facture Tiime ${index + 1}`,
        amount: opportunityAmount || 0, // Utiliser le montant de l'opportunité comme approximation
        date: new Date().toISOString(),
        url,
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
        url: note.googleDocUrl, // Ajouter l'URL du Google Docs
        payments: notePayments
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const revenueItems = buildRevenueItems();

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

  const getRemainingAmount = (item: RevenueItem): number => {
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

  const getStatusBadge = (item: RevenueItem) => {
    // Pour les devis, utiliser le statut du devis
    if (item.type === 'QUOTE' && item.status) {
      return getQuoteStatusBadge(item.status);
    }
    
    // Pour factures et notes de débours, utiliser le système de paiement
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

  const getTypeIcon = (type: RevenueItem['type']) => {
    switch (type) {
      case 'QUOTE':
        return <DocumentTextIcon className="h-5 w-5 text-indigo-600" />;
      case 'INVOICE':
        return <DocumentTextIcon className="h-5 w-5 text-amber-600" />;
      case 'DEBOURS_NOTE':
        return <ReceiptRefundIcon className="h-5 w-5 text-purple-600" />;
    }
  };

  const getTypeLabel = (type: RevenueItem['type']) => {
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

  const handleAddPayment = (item: RevenueItem) => {
    setSelectedRevenueItem(item);
    setSelectedPayment(null); // Mode création
    setShowPaymentModal(true);
  };

  const handleEditPayment = (payment: Payment, item: RevenueItem) => {
    setSelectedRevenueItem(item);
    setSelectedPayment(payment); // Mode édition
    setShowPaymentModal(true);
  };

  const handleDeletePayment = async (payment: Payment, e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher l'ouverture du modal d'édition
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      return;
    }

    try {
      await paymentService.delete(payment.id);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la suppression du paiement');
    }
  };

  const handleDeleteDeboursNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette note de débours ?\n\nLa note et le document Google Docs associé seront définitivement supprimés.')) {
      return;
    }

    if (onDeleteDeboursNote) {
      try {
        await onDeleteDeboursNote(noteId);
        onRefresh();
      } catch (error: any) {
        alert(error.response?.data?.message || 'Erreur lors de la suppression de la note de débours');
      }
    }
  };

  const handlePaymentSuccess = () => {
    onRefresh();
    setShowPaymentModal(false);
    setSelectedRevenueItem(null);
    setSelectedPayment(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Tableau des recettes</h2>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Boutons d'action */}
          {onCreateQuote && (
            <button
              onClick={onCreateQuote}
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Devis
            </button>
          )}
          {onCreateDeboursNote && (
            <button
              onClick={onCreateDeboursNote}
              className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Note
            </button>
          )}
        </div>
      </div>

      {revenueItems.length === 0 ? (
        <div className="py-12 text-center">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-4 text-sm text-slate-500">Aucun document de recette</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Document</th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Montant TTC</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Payé</th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Reste dû</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</th>
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {revenueItems.map((item) => {
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
                        className={`px-2 py-2 ${item.type === 'QUOTE' && item.quoteId ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                        onClick={() => {
                          if (item.type === 'QUOTE' && item.quoteId) {
                            navigate(`/quotes/${item.quoteId}?opportunityId=${opportunityId}`);
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {getTypeIcon(item.type)}
                          <span className={`text-xs ${item.type === 'QUOTE' && item.quoteId ? 'text-indigo-600 hover:text-indigo-700 font-medium' : 'text-slate-600'}`}>
                            {getTypeLabel(item.type)}
                          </span>
                        </div>
                      </td>
                      <td 
                        className={`px-2 py-2 ${item.type === 'QUOTE' && item.quoteId ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                        onClick={() => {
                          if (item.type === 'QUOTE' && item.quoteId) {
                            navigate(`/quotes/${item.quoteId}?opportunityId=${opportunityId}`);
                          }
                        }}
                      >
                        {item.type === 'QUOTE' && item.quoteId ? (
                          <span className="text-xs font-medium text-indigo-600 hover:text-indigo-700">{item.title}</span>
                        ) : item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                            title="Ouvrir le document Google Docs"
                          >
                            <DocumentTextIcon className="h-3.5 w-3.5" />
                            {item.title}
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-slate-900">{item.title}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600">
                        {formatDate(item.date)}
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
                              onClick={() => navigate(`/quotes/${item.quoteId}?opportunityId=${opportunityId}`)}
                              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                            >
                              <PencilIcon className="h-3 w-3" />
                              Éditer
                            </button>
                          ) : item.type === 'DEBOURS_NOTE' && item.deboursNoteId ? (
                            <>
                              {onEditDeboursNote && (
                                <button
                                  onClick={() => {
                                    const note = deboursNotes.find(n => n.id === item.deboursNoteId);
                                    if (note) onEditDeboursNote(note);
                                  }}
                                  className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                  Éditer
                                </button>
                              )}
                              <button
                                onClick={() => handleAddPayment(item)}
                                className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700"
                              >
                                <PlusIcon className="h-3 w-3" />
                                Paiement
                              </button>
                              {onDeleteDeboursNote && (
                                <button
                                  onClick={(e) => handleDeleteDeboursNote(item.deboursNoteId!, e)}
                                  className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                                  title="Supprimer la note de débours"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleAddPayment(item)}
                              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                            >
                              <PlusIcon className="h-3 w-3" />
                              Paiement
                            </button>
                          )}
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
                              colSpan={2} 
                              className="px-2 py-1.5 pl-8 cursor-pointer"
                              onClick={() => handleEditPayment(payment, item)}
                            >
                              <div className="flex items-center gap-1.5">
                                <BanknotesIcon className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-xs text-slate-600">Paiement</span>
                              </div>
                            </td>
                            <td 
                              className="px-2 py-1.5 text-xs text-slate-600 cursor-pointer"
                              onClick={() => handleEditPayment(payment, item)}
                            >
                              {formatDate(payment.paymentDate)}
                            </td>
                            <td></td>
                            <td 
                              className="px-2 py-1.5 text-right text-xs font-medium text-slate-900 cursor-pointer"
                              onClick={() => handleEditPayment(payment, item)}
                            >
                              {formatCurrency(parseFloat(payment.amount.toString()))}
                            </td>
                            <td></td>
                            <td></td>
                            <td className="px-2 py-1.5">
                              <button
                                onClick={(e) => handleDeletePayment(payment, e)}
                                className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                                title="Supprimer le paiement"
                              >
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </td>
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

      {/* Modal de paiement */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedRevenueItem(null);
            setSelectedPayment(null);
          }}
          payment={selectedPayment || undefined}
          opportunityId={selectedPayment?.opportunityId || (selectedRevenueItem ? opportunityId : undefined)}
          opportunityTitle={selectedPayment?.opportunity?.title || (selectedRevenueItem ? opportunityTitle : undefined)}
          opportunityAmount={selectedRevenueItem ? opportunityAmount : undefined}
          opportunityTaxRate={selectedRevenueItem ? opportunityTaxRate : undefined}
          deboursNoteId={selectedPayment?.deboursNoteId || selectedRevenueItem?.deboursNoteId}
          deboursNoteTitle={selectedPayment?.deboursNote?.title || (selectedRevenueItem?.deboursNoteId ? selectedRevenueItem.title : undefined)}
          deboursNoteAmount={selectedRevenueItem?.deboursNoteId ? selectedRevenueItem.amount : undefined}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
