import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { expensesService, Expense, ExpenseStatus, ExpenseFilters } from '../services/expensesService';
import { recurringExpensesService, RecurringExpense } from '../services/recurringExpensesService';
import { ExpenseUploadModal } from '../components/ExpenseUploadModal';

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSED: 'bg-blue-100 text-blue-700',
  VERIFIED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700'
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'En attente',
  PROCESSED: 'Traité',
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté'
};

export function ExpensesPage() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState<ExpenseFilters>({});

  useEffect(() => {
    void loadExpenses();
    void loadRecurringExpenses();
  }, [filters]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await expensesService.getAll(filters);
      setExpenses(data);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecurringExpenses = async () => {
    try {
      const data = await recurringExpensesService.getAll();
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Erreur chargement dépenses récurrentes:', error);
    }
  };

  const handleGenerateForecast = async (recurringExpenseId: string) => {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 12);
      
      const generated = await recurringExpensesService.generateForecast(
        recurringExpenseId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      alert(`${generated.length} dépense(s) prévisionnelle(s) générée(s)`);
      await loadExpenses(); // Recharger la liste des dépenses
    } catch (error) {
      console.error('Erreur génération prévisionnelles:', error);
      alert('Erreur lors de la génération des dépenses prévisionnelles');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      return;
    }
    try {
      await expensesService.delete(id);
      await loadExpenses();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleValidateForecast = async (id: string) => {
    try {
      await expensesService.validateForecast(id);
      await loadExpenses();
    } catch (error) {
      console.error('Erreur validation:', error);
      alert('Erreur lors de la validation');
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  // Sécuriser contre un éventuel tableau nul renvoyé par l'API
  const safeExpenses = Array.isArray(expenses) ? expenses : [];

  const filteredExpenses = safeExpenses.filter(expense => {
    if (filters.status && expense.status !== filters.status) return false;
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Dépenses</h1>
          <p className="text-sm text-slate-500">Gérez vos factures et tickets de dépense.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Nouvelle dépense</span>
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as ExpenseStatus || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Tous</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date début
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date fin
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Aucune dépense trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Fournisseur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">N° Facture</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Montant HT</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">TVA</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">TTC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Compte</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {formatDate(expense.invoiceDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {expense.supplierName || expense.company?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {expense.invoiceNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-900">
                      {formatCurrency(expense.amountHT)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">
                      {formatCurrency(expense.vatAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">
                      {formatCurrency(expense.amountTTC)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {expense.accountCode || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[expense.status]}`}>
                          {STATUS_LABELS[expense.status]}
                        </span>
                        {expense.isForecast && (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            Prévisionnel
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex justify-end gap-2">
                        {expense.isForecast && (
                          <button
                            onClick={() => handleValidateForecast(expense.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            title="Valider cette dépense prévisionnelle"
                          >
                            <CheckIcon className="w-4 h-4" />
                            Vérifier
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/depenses/${expense.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Voir
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseUploadModal
          onClose={() => {
            setShowModal(false);
            void loadExpenses();
          }}
        />
      )}
    </div>
  );
}

