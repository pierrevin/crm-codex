import { Expense } from '../services/expensesService';

interface Opportunity {
  id: string;
  title: string;
  amount?: number | string | null;
  stage?: string;
}

interface CompanyMetricsProps {
  opportunities?: Opportunity[];
  expenses: Expense[];
}

export function CompanyMetrics({
  opportunities = [],
  expenses
}: CompanyMetricsProps) {
  // Calculer le CA global : somme des montants de toutes les opportunités
  const ca = opportunities.reduce((sum, opp) => {
    return sum + (opp.amount ? parseFloat(opp.amount.toString()) : 0);
  }, 0);

  // Calculer le total des dépenses liées aux opportunités de l'entreprise
  const totalExpenses = expenses.reduce((sum, expense) => {
    const amount = expense.amountTTC ? parseFloat(expense.amountTTC.toString()) : 
                   expense.amountHT ? parseFloat(expense.amountHT.toString()) : 0;
    return sum + amount;
  }, 0);

  // Calculer la rentabilité
  const profitability = ca - totalExpenses;
  const profitabilityPercentage = ca > 0 ? (profitability / ca) * 100 : 0;

  // Trouver la valeur max pour le graphique
  const maxValue = Math.max(ca, totalExpenses, Math.abs(profitability), 1);

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
          <p className="text-xs font-medium text-blue-700 mb-1">CA Global</p>
          <p className="text-lg font-bold text-blue-900">{formatCurrency(ca)}</p>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700 mb-1">Dépenses</p>
          <p className="text-lg font-bold text-red-900">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className={`rounded-lg border p-3 ${
          profitability >= 0 
            ? 'border-emerald-200 bg-emerald-50' 
            : 'border-amber-200 bg-amber-50'
        }`}>
          <p className={`text-xs font-medium mb-1 ${
            profitability >= 0 ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            Rentabilité
          </p>
          <p className={`text-lg font-bold ${
            profitability >= 0 ? 'text-emerald-900' : 'text-amber-900'
          }`}>
            {formatCurrency(profitability)}
          </p>
        </div>
      </div>

      {ca === 0 && totalExpenses === 0 && (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-500">Aucune donnée financière disponible</p>
        </div>
      )}
    </div>
  );
}
