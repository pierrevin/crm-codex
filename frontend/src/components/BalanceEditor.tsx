import { useState, FormEvent, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { treasuryService } from '../services/treasuryService';

interface BalanceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onSuccess: () => void;
}

export function BalanceEditor({
  isOpen,
  onClose,
  currentBalance,
  onSuccess
}: BalanceEditorProps) {
  const [balance, setBalance] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBalance(currentBalance.toFixed(2));
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
    }
  }, [isOpen, currentBalance]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await treasuryService.setBalance({
        balance: parseFloat(balance),
        date: date ? new Date(date + 'T00:00:00').toISOString() : undefined,
        notes: notes || undefined
      });
      // Le solde sera rechargé par onSuccess, mais on peut déjà confirmer
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement du solde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            Définir le solde de trésorerie
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded">
          <p className="font-medium text-slate-900 mb-2">Solde actuel :</p>
          <p className="text-2xl font-bold text-slate-900 mb-2">{currentBalance.toFixed(2)} €</p>
          <p className="text-xs text-slate-600 mb-3">
            Entrez le solde réel de votre trésorerie pour ajuster les graphiques. 
            Ce solde manuel ne sera pas recalculé automatiquement.
          </p>
          <div className="bg-white border border-slate-300 rounded p-2 text-xs text-slate-700">
            <p className="font-medium mb-1">💡 Astuce :</p>
            <p>Utilisez cette fonctionnalité pour corriger le solde si des dépenses ou recettes ne sont pas encore saisies dans le système.</p>
          </div>
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
                Solde (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
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
              disabled={loading || !balance}
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

