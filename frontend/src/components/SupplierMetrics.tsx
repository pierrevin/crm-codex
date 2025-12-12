import { Expense } from '../services/expensesService';

interface SupplierMetricsProps {
  expenses: Expense[];
}

export function SupplierMetrics({
  expenses
}: SupplierMetricsProps) {
  // Calculer le total des dépenses TTC
  const totalTTC = expenses.reduce((sum, expense) => {
    const amount = expense.amountTTC ? parseFloat(expense.amountTTC.toString()) : 0;
    return sum + amount;
  }, 0);

  // Calculer le total HT
  const totalHT = expenses.reduce((sum, expense) => {
    const amount = expense.amountHT ? parseFloat(expense.amountHT.toString()) : 0;
    return sum + amount;
  }, 0);

  // Calculer le total TVA
  const totalTVA = expenses.reduce((sum, expense) => {
    const amount = expense.vatAmount ? parseFloat(expense.vatAmount.toString()) : 0;
    return sum + amount;
  }, 0);

  // Calculer par période (année en cours, mois en cours)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const thisYear = expenses
    .filter(expense => {
      if (!expense.invoiceDate) return false;
      const date = new Date(expense.invoiceDate);
      return date.getFullYear() === currentYear;
    })
    .reduce((sum, expense) => {
      const amount = expense.amountTTC ? parseFloat(expense.amountTTC.toString()) : 0;
      return sum + amount;
    }, 0);

  const thisMonth = expenses
    .filter(expense => {
      if (!expense.invoiceDate) return false;
      const date = new Date(expense.invoiceDate);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    })
    .reduce((sum, expense) => {
      const amount = expense.amountTTC ? parseFloat(expense.amountTTC.toString()) : 0;
      return sum + amount;
    }, 0);

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
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Synthèse des dépenses</h3>
      
      {/* Cartes de métriques */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs font-medium text-indigo-700 mb-1">Total TTC</p>
          <p className="text-lg font-bold text-indigo-900">{formatCurrency(totalTTC)}</p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">Total HT</p>
          <p className="text-lg font-bold text-blue-900">{formatCurrency(totalHT)}</p>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-medium text-green-700 mb-1">Total TVA</p>
          <p className="text-lg font-bold text-green-900">{formatCurrency(totalTVA)}</p>
        </div>

        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <p className="text-xs font-medium text-purple-700 mb-1">Année {currentYear}</p>
          <p className="text-lg font-bold text-purple-900">{formatCurrency(thisYear)}</p>
        </div>
      </div>

      {/* Métrique mois en cours */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-700 mb-1">
          {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </p>
        <p className="text-lg font-bold text-slate-900">{formatCurrency(thisMonth)}</p>
      </div>

      {expenses.length === 0 && (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-500">Aucune dépense enregistrée</p>
        </div>
      )}
    </div>
  );
}
