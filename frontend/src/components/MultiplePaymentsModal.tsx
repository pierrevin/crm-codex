import { useState, FormEvent, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { paymentService, CreatePaymentDto } from '../services/paymentService';
import api from '../services/apiClient';

interface PaymentRow {
  id: string;
  amount: string;
  paymentDate: string;
  taxRate: string;
  notes: string;
}

interface MultiplePaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  opportunityAmount?: number;
  opportunityTaxRate?: number;
  onSuccess: () => void;
  markAsFullyPaid?: boolean;
}

export function MultiplePaymentsModal({
  isOpen,
  onClose,
  opportunityId,
  opportunityTitle,
  opportunityAmount,
  opportunityTaxRate,
  onSuccess,
  markAsFullyPaid: initialMarkAsFullyPaid = false
}: MultiplePaymentsModalProps) {
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    {
      id: '1',
      amount: opportunityAmount?.toString() || '',
      paymentDate: new Date().toISOString().split('T')[0],
      taxRate: opportunityTaxRate ? (opportunityTaxRate * 100).toString() : '27',
      notes: ''
    }
  ]);
  const [markAsFullyPaid, setMarkAsFullyPaid] = useState(initialMarkAsFullyPaid);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Réinitialiser avec une ligne par défaut
      setPaymentRows([{
        id: '1',
        amount: opportunityAmount?.toString() || '',
        paymentDate: new Date().toISOString().split('T')[0],
        taxRate: opportunityTaxRate ? (opportunityTaxRate * 100).toString() : '27',
        notes: ''
      }]);
      setMarkAsFullyPaid(false);
      setError(null);
    }
  }, [isOpen, opportunityAmount, opportunityTaxRate]);

  if (!isOpen) return null;

  const addPaymentRow = () => {
    const newRow: PaymentRow = {
      id: Date.now().toString(),
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      taxRate: opportunityTaxRate ? (opportunityTaxRate * 100).toString() : '27',
      notes: ''
    };
    setPaymentRows([...paymentRows, newRow]);
  };

  const removePaymentRow = (id: string) => {
    if (paymentRows.length > 1) {
      setPaymentRows(paymentRows.filter(row => row.id !== id));
    }
  };

  const updatePaymentRow = (id: string, field: keyof PaymentRow, value: string) => {
    setPaymentRows(paymentRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Valider les lignes
      const validRows = paymentRows.filter(row => 
        row.amount && parseFloat(row.amount) > 0 && row.paymentDate
      );

      if (validRows.length === 0) {
        setError('Au moins un paiement valide est requis');
        setLoading(false);
        return;
      }

      // Créer les paiements séquentiellement
      const paymentPromises = validRows.map(row => {
        const dto: CreatePaymentDto = {
          opportunityId,
          amount: parseFloat(row.amount),
          // IMPORTANT: on envoie une date en UTC minuit pour éviter les décalages timezone (ex: 23:00 en base)
          paymentDate: row.paymentDate ? `${row.paymentDate}T00:00:00.000Z` : undefined,
          taxRate: row.taxRate ? parseFloat(row.taxRate) / 100 : undefined,
          notes: row.notes || undefined
        };
        return paymentService.create(dto);
      });

      await Promise.all(paymentPromises);

      // Si marquer comme payé en intégralité, changer le statut de l'opportunité
      if (markAsFullyPaid) {
        try {
          await api.patch(`/api/opportunities/${opportunityId}`, {
            stage: 'FINALIZED'
          });
        } catch (err) {
          console.error('Erreur lors de la mise à jour du statut:', err);
          // Ne pas bloquer si la mise à jour du statut échoue
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création des paiements');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return paymentRows.reduce((sum, row) => {
      const amount = parseFloat(row.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            Ajouter des paiements
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600 mb-6">
            Opportunité : <span className="font-medium">{opportunityTitle}</span>
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {paymentRows.map((row, index) => (
                <div key={row.id} className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Paiement {index + 1}
                    </h3>
                    {paymentRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePaymentRow(row.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Montant (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => updatePaymentRow(row.id, 'amount', e.target.value)}
                        required
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Date de paiement *
                      </label>
                      <input
                        type="date"
                        value={row.paymentDate}
                        onChange={(e) => updatePaymentRow(row.id, 'paymentDate', e.target.value)}
                        required
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Taux de taxe (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.taxRate}
                        onChange={(e) => updatePaymentRow(row.id, 'taxRate', e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                      {row.amount && row.taxRate && parseFloat(row.taxRate) > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          Taxes : {(parseFloat(row.amount) * parseFloat(row.taxRate) / 100).toFixed(2)} €
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Notes (optionnel)
                      </label>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => updatePaymentRow(row.id, 'notes', e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addPaymentRow}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Ajouter un paiement
              </button>
            </div>

            {/* Total et checkbox */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-700">Total des paiements :</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="markAsFullyPaid"
                  checked={markAsFullyPaid}
                  onChange={(e) => setMarkAsFullyPaid(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="markAsFullyPaid" className="text-sm text-slate-700">
                  Marquer comme payé en intégralité (changera le statut de l'opportunité vers "Finalisé / réglé")
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || paymentRows.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer les paiements'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

