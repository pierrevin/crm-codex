import { useState, FormEvent, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { expensesService, CreateExpenseDto } from '../services/expensesService';
import api from '../services/apiClient';

interface ExpenseManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExpenseManualModal({
  isOpen,
  onClose,
  onSuccess
}: ExpenseManualModalProps) {
  const [supplierName, setSupplierName] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amountTTC, setAmountTTC] = useState<string>('');
  const [amountHT, setAmountHT] = useState<string>('');
  const [vatRate, setVatRate] = useState<string>('20');
  const [vatAmount, setVatAmount] = useState<string>('');
  const [accountCode, setAccountCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSupplierName('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setAmountTTC('');
      setAmountHT('');
      setVatRate('20');
      setVatAmount('');
      setAccountCode('');
      setNotes('');
      setSelectedCompanyId('');
      setError(null);
      void loadCompanies();
    }
  }, [isOpen]);

  const loadCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    }
  };

  // Calculer automatiquement les montants
  useEffect(() => {
    if (amountHT && vatRate) {
      const ht = parseFloat(amountHT);
      const rate = parseFloat(vatRate) / 100;
      const ttc = ht * (1 + rate);
      setAmountTTC(ttc.toFixed(2));
      setVatAmount((ttc - ht).toFixed(2));
    } else if (amountTTC && vatRate) {
      const ttc = parseFloat(amountTTC);
      const rate = parseFloat(vatRate) / 100;
      const ht = ttc / (1 + rate);
      setAmountHT(ht.toFixed(2));
      setVatAmount((ttc - ht).toFixed(2));
    }
  }, [amountHT, amountTTC, vatRate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dto: CreateExpenseDto = {
        supplierName: supplierName || undefined,
        invoiceDate: invoiceDate ? new Date(invoiceDate + 'T00:00:00').toISOString() : undefined,
        amountHT: amountHT ? parseFloat(amountHT) : undefined,
        amountTTC: amountTTC ? parseFloat(amountTTC) : undefined,
        vatRate: vatRate ? parseFloat(vatRate) / 100 : undefined,
        vatAmount: vatAmount ? parseFloat(vatAmount) : undefined,
        accountCode: accountCode || undefined,
        notes: notes || undefined,
        companyId: selectedCompanyId || undefined,
        status: 'VERIFIED' // Directement vérifié car pas de justificatif à vérifier
      };

      await expensesService.create(dto);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la dépense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            Ajouter une dépense sans justificatif
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fournisseur / Libellé
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Ex: Virement compte perso"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date de facture
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Montant HT (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amountHT}
                  onChange={(e) => setAmountHT(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Montant TTC (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amountTTC}
                  onChange={(e) => setAmountTTC(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Taux TVA (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  TVA (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={vatAmount}
                  readOnly
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Code comptable
              </label>
              <input
                type="text"
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Ex: 606000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client (optionnel)
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Aucun</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
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
                placeholder="Ex: Virement vers compte personnel"
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
              disabled={loading || !amountTTC || !invoiceDate}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

