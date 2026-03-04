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
  TrashIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Payment, paymentService } from '../services/paymentService';
import { Invoice } from '../services/invoiceService';
import { DeboursNote } from '../services/deboursNoteService';
import { PaymentModal } from './PaymentModal';
import { Button } from './ui/Button';

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
  type: 'QUOTE' | 'INVOICE' | 'DEBOURS_NOTE' | 'PROVISIONAL';
  title: string;
  amount: number;
  date: string;
  url?: string;
  status?: string;
  deboursNoteId?: string;
  quoteId?: string; // ID du devis pour navigation
  invoiceId?: string; // ID de la facture
  payments: Payment[];
  isProvisional?: boolean; // Pour distinguer le prévisionnel
}

interface RevenueTableProps {
  quotes: Quote[];
  invoiceUrls: string[];
  invoices?: Invoice[];
  deboursNotes: DeboursNote[];
  payments: Payment[];
  opportunityId: string;
  opportunityTitle: string;
  opportunityAmount?: number;
  opportunityExpectedPaymentDate?: string;
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
  invoices = [],
  deboursNotes,
  payments,
  opportunityId,
  opportunityTitle,
  opportunityAmount,
  opportunityExpectedPaymentDate,
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
      const quotePayments = payments.filter(p => !p.deboursNoteId && !p.invoiceId);
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

    // Ajouter les factures (Invoice)
    invoices.forEach(invoice => {
      const invoicePayments = payments.filter(p => p.invoiceId === invoice.id);
      items.push({
        id: `invoice-${invoice.id}`,
        type: 'INVOICE',
        title: invoice.invoiceNumber || `Facture ${invoice.type === 'ACOMPTE' ? 'acompte' : 'finale'}`,
        amount: Number(invoice.amountTTC),
        date: invoice.issueDate,
        invoiceId: invoice.id,
        url: invoice.invoiceUrl,
        payments: invoicePayments
      });
    });

    // Ajouter les factures Tiime (anciennes)
    invoiceUrls.forEach((url, index) => {
      const invoicePayments = payments.filter(p => !p.deboursNoteId && !p.invoiceId);
      items.push({
        id: `invoice-tiime-${index}`,
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

    // Calculer les totaux globaux pour le paiement prévisionnel
    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amountTTC || 0), 0);
    const totalPaidOverall = payments.reduce(
      (sum, p) => sum + parseFloat(p.amount.toString()),
      0
    );
    const targetAmount = opportunityAmount || totalInvoiced || 0;
    const remainingToCollect = Math.max(0, targetAmount - totalPaidOverall);

    // Ajouter le paiement prévisionnel si applicable :
    // il représente le reste à encaisser sur l'opportunité, uniquement s'il reste un solde.
    if (opportunityExpectedPaymentDate && remainingToCollect > 0) {
      items.push({
        id: 'provisional-payment',
        type: 'PROVISIONAL',
        title: 'Paiement prévisionnel',
        amount: remainingToCollect,
        date: opportunityExpectedPaymentDate,
        payments: [],
        isProvisional: true
      });
    }

    // Ajouter les paiements "orphelins" (sans facture, devis ou note de débours)
    const usedPaymentIds = new Set<string>();
    items.forEach(item => {
      item.payments.forEach(p => usedPaymentIds.add(p.id));
    });

    const orphanPayments = payments.filter(p => 
      !usedPaymentIds.has(p.id) && 
      !p.deboursNoteId && 
      !p.invoiceId
    );

    if (orphanPayments.length > 0) {
      // Créer un item pour les paiements orphelins
      const totalAmount = orphanPayments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
      items.push({
        id: 'orphan-payments',
        type: 'INVOICE' as const,
        title: 'Paiements directs',
        amount: totalAmount,
        date: orphanPayments[0]?.paymentDate || new Date().toISOString(),
        payments: orphanPayments
      });
    }

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
      case 'PROVISIONAL':
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
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
      case 'PROVISIONAL':
        return 'Paiement prévisionnel';
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
          <Button
            onClick={() => {
              setSelectedRevenueItem(null);
              setSelectedPayment(null);
              setShowPaymentModal(true);
            }}
            variant="primary"
            size="sm"
            icon={<BanknotesIcon className="h-3.5 w-3.5" />}
            className="bg-green-600 hover:bg-green-700"
          >
            Paiement
          </Button>
          {onCreateQuote && (
            <Button
              onClick={onCreateQuote}
              variant="primary"
              size="sm"
              icon={<PlusIcon className="h-3.5 w-3.5" />}
            >
              Devis
            </Button>
          )}
          {onCreateDeboursNote && (
            <Button
              onClick={onCreateDeboursNote}
              variant="primary"
              size="sm"
              icon={<PlusIcon className="h-3.5 w-3.5" />}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Note
            </Button>
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
                        className={`px-2 py-2 transition-colors ${
                          (item.type === 'QUOTE' && item.quoteId) || (item.type === 'DEBOURS_NOTE' && item.deboursNoteId && onEditDeboursNote)
                            ? 'cursor-pointer hover:bg-slate-100' 
                            : ''
                        }`}
                        onClick={() => {
                          if (item.type === 'QUOTE' && item.quoteId) {
                            navigate(`/quotes/${item.quoteId}?opportunityId=${opportunityId}`);
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
                              {item.id === 'orphan-payments' || item.isProvisional ? item.title : getTypeLabel(item.type)}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 pl-6">
                            {formatDate(item.date)}
                          </span>
                        </div>
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
                            <Button
                              onClick={() => navigate(`/quotes/${item.quoteId}?opportunityId=${opportunityId}`)}
                              variant="primary"
                              size="sm"
                              icon={<PencilIcon className="h-3 w-3" />}
                            >
                              Éditer
                            </Button>
                          ) : item.type === 'DEBOURS_NOTE' && item.deboursNoteId ? (
                            <>
                              {item.url && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.url, '_blank', 'noopener,noreferrer');
                                  }}
                                  variant="secondary"
                                  size="sm"
                                  icon={<DocumentTextIcon className="h-3 w-3" />}
                                  title="Ouvrir le document Google Docs"
                                >
                                  <span className="sr-only">Ouvrir le document</span>
                                </Button>
                              )}
                              {onEditDeboursNote && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const note = deboursNotes.find(n => n.id === item.deboursNoteId);
                                    if (note) onEditDeboursNote(note);
                                  }}
                                  variant="primary"
                                  size="sm"
                                  icon={<PencilIcon className="h-3 w-3" />}
                                >
                                  Éditer
                                </Button>
                              )}
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddPayment(item);
                                }}
                                variant="success"
                                size="sm"
                                icon={<PlusIcon className="h-3 w-3" />}
                              >
                                Paiement
                              </Button>
                              {onDeleteDeboursNote && (
                                <Button
                                  onClick={(e) => handleDeleteDeboursNote(item.deboursNoteId!, e)}
                                  variant="danger"
                                  size="sm"
                                  icon={<TrashIcon className="h-3 w-3" />}
                                  title="Supprimer la note de débours"
                                >
                                  <span className="sr-only">Supprimer</span>
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddPayment(item);
                                }}
                                variant="success"
                                size="sm"
                                icon={<PlusIcon className="h-3 w-3" />}
                              >
                                Paiement
                              </Button>
                              {item.id === 'orphan-payments' && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Pour les paiements orphelins, permettre d'ajouter un nouveau paiement direct
                                    setSelectedRevenueItem(null);
                                    setSelectedPayment(null);
                                    setShowPaymentModal(true);
                                  }}
                                  variant="primary"
                                  size="sm"
                                  icon={<BanknotesIcon className="h-3 w-3" />}
                                >
                                  Ajouter
                                </Button>
                              )}
                            </>
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
                              className="px-2 py-1.5 pl-8 cursor-pointer"
                              onClick={() => handleEditPayment(payment, item)}
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
                            <td 
                              className="px-2 py-1.5 text-right text-xs font-medium text-slate-900 cursor-pointer"
                              onClick={() => handleEditPayment(payment, item)}
                            >
                              {formatCurrency(parseFloat(payment.amount.toString()))}
                            </td>
                            <td></td>
                            <td></td>
                            <td className="px-2 py-1.5">
                              <Button
                                onClick={(e) => handleDeletePayment(payment, e)}
                                variant="danger"
                                size="sm"
                                icon={<TrashIcon className="h-3 w-3" />}
                                title="Supprimer le paiement"
                              >
                                <span className="sr-only">Supprimer</span>
                              </Button>
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
          opportunityId={selectedPayment?.opportunityId || opportunityId}
          opportunityTitle={selectedPayment?.opportunity?.title || opportunityTitle}
          opportunityAmount={selectedRevenueItem ? opportunityAmount : opportunityAmount}
          opportunityTaxRate={selectedRevenueItem ? opportunityTaxRate : opportunityTaxRate}
          deboursNoteId={selectedPayment?.deboursNoteId || selectedRevenueItem?.deboursNoteId}
          deboursNoteTitle={selectedPayment?.deboursNote?.title || (selectedRevenueItem?.deboursNoteId ? selectedRevenueItem.title : undefined)}
          deboursNoteAmount={selectedRevenueItem?.deboursNoteId ? selectedRevenueItem.amount : undefined}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
