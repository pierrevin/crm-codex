import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon, BanknotesIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { invoiceService, Invoice } from '../services/invoiceService';
import { paymentService, Payment } from '../services/paymentService';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { MultiplePaymentsModal } from './MultiplePaymentsModal';

interface InvoiceListProps {
  opportunityId: string;
  opportunityTitle: string;
  opportunityTaxRate?: number;
  onRefresh: () => void;
}

export function InvoiceList({
  opportunityId,
  opportunityTitle,
  opportunityTaxRate,
  onRefresh
}: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoicesData, paymentsData] = await Promise.all([
        invoiceService.getByOpportunity(opportunityId),
        paymentService.getByOpportunity(opportunityId)
      ]);
      setInvoices(invoicesData);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [opportunityId]);

  const toggleInvoice = (invoiceId: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
    }
    setExpandedInvoices(newExpanded);
  };

  const getTotalPaid = (invoice: Invoice): number => {
    const invoicePayments = payments.filter(p => p.invoiceId === invoice.id);
    return invoicePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const getRemainingAmount = (invoice: Invoice): number => {
    const totalPaid = getTotalPaid(invoice);
    return Math.max(0, Number(invoice.amountTTC) - totalPaid);
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

  const handleDelete = async (invoice: Invoice) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer cette facture ?`)) {
      return;
    }

    try {
      await invoiceService.delete(invoice.id);
      await loadData();
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleAddPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    await loadData();
    onRefresh();
    setShowPaymentModal(false);
    setSelectedInvoice(null);
  };

  const handleCreateSuccess = async () => {
    await loadData();
    onRefresh();
    setShowCreateModal(false);
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Chargement...</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Factures</h2>
        <button
          onClick={() => {
            console.log('Bouton cliqué, showCreateModal sera:', true);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <PlusIcon className="h-5 w-5" />
          Ajouter une facture
        </button>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12">
          <BanknotesIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-sm text-slate-500">Aucune facture pour cette opportunité</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const totalPaid = getTotalPaid(invoice);
            const remaining = getRemainingAmount(invoice);
            const isExpanded = expandedInvoices.has(invoice.id);
            const invoicePayments = payments.filter(p => p.invoiceId === invoice.id);

            return (
              <div key={invoice.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div
                  className="p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                  onClick={() => toggleInvoice(invoice.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-slate-400" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            invoice.type === 'ACOMPTE' 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {invoice.type === 'ACOMPTE' ? 'Acompte' : 'Finale'}
                          </span>
                          {invoice.invoiceNumber && (
                            <span className="text-sm font-medium text-slate-900">
                              {invoice.invoiceNumber}
                            </span>
                          )}
                          <span className="text-sm text-slate-500">
                            {formatDate(invoice.issueDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-medium text-slate-900">
                            {formatCurrency(Number(invoice.amountTTC))}
                          </span>
                          {totalPaid > 0 && (
                            <>
                              <span className="text-slate-500">
                                Payé : {formatCurrency(totalPaid)}
                              </span>
                              {remaining > 0 && (
                                <span className="text-amber-600">
                                  Reste : {formatCurrency(remaining)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {invoice.invoiceUrl && (
                        <a
                          href={invoice.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-indigo-600"
                          title="Ouvrir dans Tiime"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleAddPayment(invoice)}
                        className="p-2 text-slate-400 hover:text-indigo-600"
                        title="Ajouter un paiement"
                      >
                        <BanknotesIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice)}
                        className="p-2 text-red-400 hover:text-red-600"
                        title="Supprimer"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">Paiements</h4>
                      {invoicePayments.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucun paiement</p>
                      ) : (
                        <div className="space-y-2">
                          {invoicePayments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                              <div>
                                <span className="text-sm font-medium text-slate-900">
                                  {formatCurrency(Number(payment.amount))}
                                </span>
                                <span className="text-xs text-slate-500 ml-2">
                                  {formatDate(payment.paymentDate)}
                                </span>
                              </div>
                              {payment.notes && (
                                <span className="text-xs text-slate-500">{payment.notes}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {invoice.notes && (
                      <div className="text-sm text-slate-600">
                        <strong>Notes :</strong> {invoice.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => {
          console.log('Fermeture du modal');
          setShowCreateModal(false);
        }}
        opportunityId={opportunityId}
        opportunityTitle={opportunityTitle}
        opportunityTaxRate={opportunityTaxRate}
        onSuccess={handleCreateSuccess}
      />

      {showPaymentModal && selectedInvoice && (
        <MultiplePaymentsModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          opportunityId={opportunityId}
          opportunityTitle={opportunityTitle}
          opportunityAmount={getRemainingAmount(selectedInvoice)}
          opportunityTaxRate={opportunityTaxRate}
          invoiceId={selectedInvoice.id}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
