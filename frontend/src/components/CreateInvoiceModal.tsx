import { useState, FormEvent, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { invoiceService, CreateInvoiceDto, InvoiceType } from '../services/invoiceService';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  opportunityTaxRate?: number;
  onSuccess: () => void;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  opportunityId,
  opportunityTitle,
  opportunityTaxRate,
  onSuccess
}: CreateInvoiceModalProps) {
  const [type, setType] = useState<InvoiceType>('FINAL');
  const [amountTTC, setAmountTTC] = useState('');
  const [taxRate, setTaxRate] = useState(opportunityTaxRate ? (opportunityTaxRate * 100).toString() : '27');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('CreateInvoiceModal - isOpen:', isOpen);
    if (isOpen) {
      // Réinitialiser le formulaire
      setType('FINAL');
      setAmountTTC('');
      setTaxRate(opportunityTaxRate ? (opportunityTaxRate * 100).toString() : '27');
      setInvoiceUrl('');
      setInvoiceNumber('');
      setIssueDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
    }
  }, [isOpen, opportunityTaxRate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dto: CreateInvoiceDto = {
        type,
        amountTTC: parseFloat(amountTTC),
        taxRate: taxRate ? parseFloat(taxRate) / 100 : undefined,
        invoiceUrl: invoiceUrl || undefined,
        invoiceNumber: invoiceNumber || undefined,
        opportunityId,
        issueDate: issueDate ? `${issueDate}T00:00:00.000Z` : undefined,
        notes: notes || undefined
      };

      await invoiceService.create(dto);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création de la facture');
    } finally {
      setLoading(false);
    }
  };

  const calculateAmountHT = () => {
    if (!amountTTC || !taxRate) return 0;
    const ttc = parseFloat(amountTTC);
    const rate = parseFloat(taxRate) / 100;
    return ttc / (1 + rate);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  };

  if (!isOpen) {
    console.log('CreateInvoiceModal - retourne null car isOpen est false');
    return null;
  }

  console.log('CreateInvoiceModal - rendu du modal');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            Créer une facture
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type de facture *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="ACOMPTE"
                      checked={type === 'ACOMPTE'}
                      onChange={(e) => setType(e.target.value as InvoiceType)}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-700">Acompte</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="FINAL"
                      checked={type === 'FINAL'}
                      onChange={(e) => setType(e.target.value as InvoiceType)}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-700">Finale</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Montant TTC (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountTTC}
                  onChange={(e) => setAmountTTC(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                {amountTTC && taxRate && (
                  <p className="mt-1 text-xs text-slate-500">
                    Montant HT : {formatCurrency(calculateAmountHT())}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Taux de taxe (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date d'émission
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Numéro de facture (optionnel)
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL facture Tiime (optionnel)
                </label>
                <input
                  type="url"
                  value={invoiceUrl}
                  onChange={(e) => setInvoiceUrl(e.target.value)}
                  placeholder="https://tiime.fr/invoice/..."
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
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
                disabled={loading || !amountTTC}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Création...' : 'Créer la facture'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
