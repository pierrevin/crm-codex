import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { expensesService, Expense, UpdateExpenseDto } from '../services/expensesService';
import { AccountCodeSelector } from './AccountCodeSelector';
import api from '../services/apiClient';

interface ExpenseValidationModalProps {
  expense: Expense;
  fileUrl: string;
  fileType?: string;
  fileName?: string;
  opportunityId?: string; // ID de l'opportunité optionnelle
  onClose: () => void;
  onSave: () => void;
}

export function ExpenseValidationModal({
  expense,
  fileUrl,
  fileType,
  fileName,
  opportunityId,
  onClose,
  onSave
}: ExpenseValidationModalProps) {
  const [saving, setSaving] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>(expense.opportunityId || opportunityId || '');
  
  // Champs modifiables
  const [supplierName, setSupplierName] = useState(expense.supplierName || '');
  const [invoiceNumber, setInvoiceNumber] = useState(expense.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(
    expense.invoiceDate ? expense.invoiceDate.split('T')[0] : ''
  );
  const [amountHT, setAmountHT] = useState(expense.amountHT?.toString() || '');
  const [amountTTC, setAmountTTC] = useState(expense.amountTTC?.toString() || '');
  const [vatAmount, setVatAmount] = useState(expense.vatAmount?.toString() || '');
  const [vatRate, setVatRate] = useState(
    expense.vatRate ? (Number(expense.vatRate) * 100).toFixed(2) : ''
  );
  const [accountCode, setAccountCode] = useState(expense.accountCode || '');
  const [accountLabel, setAccountLabel] = useState(expense.accountLabel || '');
  const [notes, setNotes] = useState(expense.notes || '');

  useEffect(() => {
    void loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    try {
      const { data } = await api.get('/api/opportunities?limit=1000');
      setOpportunities(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement opportunités:', error);
    }
  };

  // Calculer automatiquement les montants si nécessaire
  useEffect(() => {
    if (amountHT && vatRate && !amountTTC) {
      const ht = parseFloat(amountHT);
      const rate = parseFloat(vatRate) / 100;
      const ttc = ht * (1 + rate);
      setAmountTTC(ttc.toFixed(2));
      if (!vatAmount) {
        setVatAmount((ttc - ht).toFixed(2));
      }
    }
  }, [amountHT, vatRate, amountTTC, vatAmount]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: UpdateExpenseDto = {
        supplierName: supplierName || undefined,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: invoiceDate || undefined,
        amountHT: amountHT ? parseFloat(amountHT) : undefined,
        amountTTC: amountTTC ? parseFloat(amountTTC) : undefined,
        vatAmount: vatAmount ? parseFloat(vatAmount) : undefined,
        vatRate: vatRate ? parseFloat(vatRate) / 100 : undefined,
        accountCode: accountCode || undefined,
        accountLabel: accountLabel || undefined,
        notes: notes || undefined,
        status: 'PROCESSED'
      };

      await expensesService.update(expense.id, updateData);
      onSave();
      onClose();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-slate-900">Valider les informations extraites</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Aperçu du document */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Aperçu du document</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  {fileType?.startsWith('image/') ? (
                    <div className="relative">
                      <img
                        src={fileUrl}
                        alt="Aperçu facture"
                        className="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setShowImageZoom(true)}
                      />
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Cliquez pour agrandir
                      </div>
                    </div>
                  ) : fileType === 'application/pdf' ? (
                    <iframe
                      src={fileUrl}
                      className="w-full h-96"
                      title="Aperçu PDF"
                    />
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      <p>Aperçu non disponible</p>
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 mt-2 inline-block"
                      >
                        Ouvrir le fichier
                      </a>
                    </div>
                  )}
                </div>
                {fileName && (
                  <p className="text-sm text-slate-600">Fichier: {fileName}</p>
                )}
              </div>

              {/* Formulaire de validation */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">Informations extraites</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Fournisseur *
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        N° Facture
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Date facture
                      </label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Taux TVA (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={vatRate}
                        onChange={(e) => setVatRate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        TVA (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={vatAmount}
                        onChange={(e) => setVatAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-md font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <AccountCodeSelector
                        value={accountCode}
                        onChange={(code, label) => {
                          setAccountCode(code);
                          setAccountLabel(label);
                        }}
                        label="Code compte"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Libellé compte
                      </label>
                      <input
                        type="text"
                        value={accountLabel}
                        onChange={(e) => setAccountLabel(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Libellé du compte"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ajoutez des notes si nécessaire..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-slate-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                disabled={saving}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !supplierName || !accountCode}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-5 h-5" />
                {saving ? 'Enregistrement...' : 'Valider et créer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de zoom pour les images */}
      {showImageZoom && fileType?.startsWith('image/') && (
        <div 
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowImageZoom(false)}
        >
          <button
            onClick={() => setShowImageZoom(false)}
            className="absolute top-4 right-4 text-white hover:text-slate-300 z-10"
          >
            <XMarkIcon className="w-8 h-8" />
          </button>
          <img
            src={fileUrl}
            alt="Aperçu facture agrandi"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

