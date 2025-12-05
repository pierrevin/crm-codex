import { useState, FormEvent, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { deboursNoteService, CreateDeboursNoteDto, DeboursNote } from '../services/deboursNoteService';
import { expensesService, Expense } from '../services/expensesService';
import api from '../services/apiClient';

interface DeboursNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  onSuccess: () => void;
}

export function DeboursNoteModal({
  isOpen,
  onClose,
  opportunityId,
  opportunityTitle,
  onSuccess
}: DeboursNoteModalProps) {
  const [title, setTitle] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableExpenses, setAvailableExpenses] = useState<Expense[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [generatingDoc, setGeneratingDoc] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(`Note de débours - ${opportunityTitle}`);
      setIssueDate(new Date().toISOString().split('T')[0]);
      setExpectedPaymentDate('');
      setTotalAmount('');
      setNotes('');
      setSelectedExpenseIds([]);
      setError(null);
      void loadAvailableExpenses();
    }
  }, [isOpen, opportunityId, opportunityTitle]);

  const loadAvailableExpenses = async () => {
    try {
      const expenses = await expensesService.getAll({ opportunityId });
      setAvailableExpenses(expenses);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
    }
  };

  // Calculer le montant total depuis les dépenses sélectionnées
  useEffect(() => {
    if (selectedExpenseIds.length > 0) {
      const total = availableExpenses
        .filter(exp => selectedExpenseIds.includes(exp.id))
        .reduce((sum, exp) => sum + (parseFloat(exp.amountTTC?.toString() || exp.amountHT?.toString() || '0') || 0), 0);
      setTotalAmount(total.toFixed(2));
    } else {
      setTotalAmount('');
    }
  }, [selectedExpenseIds, availableExpenses]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dto: CreateDeboursNoteDto = {
        title,
        issueDate: issueDate ? new Date(issueDate + 'T00:00:00').toISOString() : undefined,
        expectedPaymentDate: expectedPaymentDate ? new Date(expectedPaymentDate + 'T00:00:00').toISOString() : undefined,
        totalAmount: parseFloat(totalAmount),
        opportunityId,
        expenseIds: selectedExpenseIds.length > 0 ? selectedExpenseIds : undefined,
        notes: notes || undefined,
        status: 'DRAFT'
      };

      const created = await deboursNoteService.create(dto);
      
      // Générer automatiquement le document Google Docs
      setGeneratingDoc(true);
      try {
        await deboursNoteService.generateDoc(created.id);
      } catch (docError: any) {
        console.error('Erreur génération document:', docError);
        // Ne pas bloquer si la génération échoue
        setError('Note créée mais erreur lors de la génération du document Google Docs. Vous pourrez le générer manuellement.');
      }
      setGeneratingDoc(false);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erreur lors de la création de la note de débours');
      setGeneratingDoc(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpense = (expenseId: string) => {
    setSelectedExpenseIds(prev =>
      prev.includes(expenseId)
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            Créer une note de débours
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Titre
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date d'émission
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date prévisionnelle de paiement
                </label>
                <input
                  type="date"
                  value={expectedPaymentDate}
                  onChange={(e) => setExpectedPaymentDate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Montant total TTC (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              {selectedExpenseIds.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Montant calculé depuis {selectedExpenseIds.length} dépense(s) sélectionnée(s)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Dépenses à inclure (optionnel)
              </label>
              <div className="border border-slate-200 rounded-md max-h-48 overflow-y-auto">
                {availableExpenses.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">
                    Aucune dépense disponible pour cette opportunité
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {availableExpenses.map(expense => (
                      <label
                        key={expense.id}
                        className="flex items-center p-3 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.includes(expense.id)}
                          onChange={() => toggleExpense(expense.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-slate-900">
                            {expense.supplierName || 'Sans nom'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {expense.invoiceDate ? new Date(expense.invoiceDate).toLocaleDateString('fr-FR') : ''}
                            {expense.amountTTC && ` • ${parseFloat(expense.amountTTC.toString()).toFixed(2)} € TTC`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
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
              disabled={loading || generatingDoc || !totalAmount || !title}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {generatingDoc ? 'Génération du document...' : loading ? 'Création...' : 'Créer et générer le document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

