import { useState, FormEvent, useEffect } from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { paymentService, CreatePaymentDto, UpdatePaymentDto, Payment } from '../services/paymentService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: Payment; // Paiement existant pour mode édition
  opportunityId?: string;
  opportunityTitle?: string;
  opportunityAmount?: number;
  opportunityTaxRate?: number;
  deboursNoteId?: string;
  deboursNoteTitle?: string;
  deboursNoteAmount?: number;
  onSuccess: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  payment, // Paiement existant pour mode édition
  opportunityId,
  opportunityTitle,
  opportunityAmount,
  opportunityTaxRate,
  deboursNoteId,
  deboursNoteTitle,
  deboursNoteAmount,
  onSuccess
}: PaymentModalProps) {
  const isEditMode = !!payment;
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [taxRate, setTaxRate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (payment) {
        // Mode édition : pré-remplir avec les données du paiement existant
        setAmount(payment.amount.toString());
        setPaymentDate(new Date(payment.paymentDate).toISOString().split('T')[0]);
        setTaxRate((payment.taxRate * 100).toString());
        setNotes(payment.notes || '');
      } else {
        // Mode création : valeurs par défaut
        const amount = deboursNoteAmount || opportunityAmount;
        setAmount(amount?.toString() || '');
        // Notes de débours : pas de taxe (0%), opportunités : taux par défaut ou 28%
        setTaxRate(deboursNoteId ? '0' : (opportunityTaxRate ? (opportunityTaxRate * 100).toString() : '28'));
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setNotes('');
      }
      setError(null);
    }
  }, [isOpen, payment, opportunityAmount, opportunityTaxRate, deboursNoteId, deboursNoteAmount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && payment) {
        // Mode édition
        const dto: UpdatePaymentDto = {
          amount: parseFloat(amount),
          // IMPORTANT: on envoie une date en UTC minuit pour éviter les décalages timezone (ex: 23:00 en base)
          paymentDate: paymentDate ? `${paymentDate}T00:00:00.000Z` : undefined,
          taxRate: taxRate ? parseFloat(taxRate) / 100 : undefined,
          notes: notes || undefined
        };
        await paymentService.update(payment.id, dto);
      } else {
        // Mode création
        const dto: CreatePaymentDto = {
          opportunityId: opportunityId || undefined,
          deboursNoteId: deboursNoteId || undefined,
          amount: parseFloat(amount),
          // IMPORTANT: on envoie une date en UTC minuit pour éviter les décalages timezone (ex: 23:00 en base)
          paymentDate: paymentDate ? `${paymentDate}T00:00:00.000Z` : undefined,
          taxRate: taxRate ? parseFloat(taxRate) / 100 : undefined,
          notes: notes || undefined
        };
        await paymentService.create(dto);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || `Erreur lors de ${isEditMode ? 'la modification' : 'la création'} du paiement`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!payment) return;
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await paymentService.delete(payment.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression du paiement');
    } finally {
      setDeleting(false);
    }
  };

  const taxAmount = amount && taxRate 
    ? (parseFloat(amount) * parseFloat(taxRate) / 100).toFixed(2)
    : '0.00';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {isEditMode ? 'Modifier le paiement' : 'Marquer comme payé'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          {payment?.deboursNoteId || deboursNoteId ? (
            <>Note de débours : <span className="font-medium">{payment?.deboursNote?.title || deboursNoteTitle}</span></>
          ) : (
            <>Opportunité : <span className="font-medium">{payment?.opportunity?.title || opportunityTitle}</span></>
          )}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Montant (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date de paiement
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              {!isEditMode && (
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    id="isDebours"
                    checked={taxRate === '0' || taxRate === '0.00'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTaxRate('0');
                      } else {
                        setTaxRate(opportunityTaxRate ? (opportunityTaxRate * 100).toString() : '28');
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isDebours" className="text-sm text-slate-700">
                    Note de débours (non soumise à taxe)
                  </label>
                </div>
              )}
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Taux de taxe (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              {amount && taxRate && parseFloat(taxRate) > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Montant des taxes : {taxAmount} €
                </p>
              )}
              {amount && taxRate && parseFloat(taxRate) === 0 && (
                <p className="mt-1 text-xs text-green-600">
                  Aucune taxe (note de débours - non soumise à taxe)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            {isEditMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            )}
            {!isEditMode && <div />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !amount}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : isEditMode ? 'Modifier' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

