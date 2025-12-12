import { CurrencyEuroIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import { Expense } from '../services/expensesService';
import { DeboursNote } from '../services/deboursNoteService';

interface OpportunityMetricsProps {
  opportunityAmount?: number;
  invoiceUrls?: string[];
  expenses: Expense[];
  paymentsTotal?: number;
  deboursNotes?: DeboursNote[];
}

export function OpportunityMetrics({
  opportunityAmount = 0,
  invoiceUrls = [],
  expenses,
  paymentsTotal = 0,
  deboursNotes = []
}: OpportunityMetricsProps) {
  // Calculer le CA total
  // CA = montant de l'opportunité (les factures Tiime sont déjà incluses dans le montant)
  const ca = opportunityAmount || 0;

  // Identifier les dépenses liées aux notes de débours
  // Les notes de débours sont des encaissements qui compensent ces dépenses
  const expenseIdsLinkedToDebours = new Set<string>();
  deboursNotes.forEach(note => {
    if (note.expenses && note.expenses.length > 0) {
      note.expenses.forEach((exp: any) => {
        expenseIdsLinkedToDebours.add(exp.id);
      });
    }
  });

  // Calculer le total des dépenses en excluant celles liées aux notes de débours
  // Car les notes de débours représentent des encaissements qui compensent ces dépenses
  const totalExpenses = expenses.reduce((sum, expense) => {
    // Si la dépense est liée à une note de débours, on ne la compte pas dans les dépenses
    // car elle est compensée par l'encaissement de la note de débours
    if (expenseIdsLinkedToDebours.has(expense.id)) {
      return sum;
    }
    const amount = expense.amountTTC ? parseFloat(expense.amountTTC.toString()) : 
                   expense.amountHT ? parseFloat(expense.amountHT.toString()) : 0;
    return sum + amount;
  }, 0);

  // Calculer la marge
  const margin = ca - totalExpenses;
  const marginPercentage = ca > 0 ? (margin / ca) * 100 : 0;

  // Trouver la valeur max pour le graphique
  const maxValue = Math.max(ca, totalExpenses, Math.abs(margin), 1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Cartes de métriques compactes */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">CA</p>
          <p className="text-lg font-bold text-blue-900">{formatCurrency(ca)}</p>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700 mb-1">Dépenses</p>
          <p className="text-lg font-bold text-red-900">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className={`rounded-lg border p-3 ${
          margin >= 0 
            ? 'border-emerald-200 bg-emerald-50' 
            : 'border-amber-200 bg-amber-50'
        }`}>
          <p className={`text-xs font-medium mb-1 ${
            margin >= 0 ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            Marge
          </p>
          <p className={`text-lg font-bold ${
            margin >= 0 ? 'text-emerald-900' : 'text-amber-900'
          }`}>
            {formatCurrency(margin)}
          </p>
        </div>
      </div>

      {/* Mini graphique horizontal */}
      {maxValue > 0 && (
        <div className="space-y-2">
          {/* Barre CA */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600">CA</span>
              <span className="text-xs text-slate-500">{formatCurrency(ca)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${(ca / maxValue) * 100}%` }}
              />
            </div>
          </div>

          {/* Barre Dépenses */}
          {totalExpenses > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">Dépenses</span>
                <span className="text-xs text-slate-500">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-red-500 h-full rounded-full transition-all"
                  style={{ width: `${(totalExpenses / maxValue) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Barre Marge */}
          {margin !== 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">Marge</span>
                <span className={`text-xs font-medium ${
                  margin >= 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {formatCurrency(margin)} ({marginPercentage >= 0 ? '+' : ''}{marginPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    margin >= 0 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${(Math.abs(margin) / maxValue) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {ca === 0 && totalExpenses === 0 && (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-500">Aucune donnée financière disponible</p>
        </div>
      )}
    </div>
  );
}

