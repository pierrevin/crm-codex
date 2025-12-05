import { useMemo } from 'react';
import { TreasuryForecast } from '../services/treasuryService';
import { Payment } from '../services/paymentService';

// Étendre l'interface pour inclure stage
interface OpportunityWithStage {
  id: string;
  amount: number | null;
  expectedPaymentDate: string;
  taxRate: number | null;
  stage?: string;
}

interface TreasuryMonthlyViewProps {
  startDate: Date;
  endDate: Date;
  currentBalance: number;
  forecast: TreasuryForecast | null;
  payments: Payment[];
  expenses: Array<{
    amountTTC: number | null;
    amountHT: number | null;
    invoiceDate: string | null;
    opportunityId?: string;
  }>;
}

interface MonthlyData {
  month: string;
  monthKey: string;
  soldeInitial: number;
  encaissementsPrevisionnels: number;
  encaissementsReels: number;
  decaissements: number;
  taxes: number;
  soldeFinal: number;
}

export function TreasuryMonthlyView({
  startDate,
  endDate,
  currentBalance,
  forecast,
  payments,
  expenses
}: TreasuryMonthlyViewProps) {
  const monthlyData = useMemo(() => {
    const data: Record<string, MonthlyData> = {};
    let runningBalance = currentBalance;

    // Générer tous les mois dans la période
    const months: string[] = [];
    const current = new Date(startDate);
    current.setDate(1); // Premier jour du mois
    while (current <= endDate) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
      data[monthKey] = {
        month: current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        monthKey,
        soldeInitial: 0,
        encaissementsPrevisionnels: 0,
        encaissementsReels: 0,
        decaissements: 0,
        taxes: 0,
        soldeFinal: 0
      };
      current.setMonth(current.getMonth() + 1);
    }

    // Calculer le solde initial du premier mois
    if (months.length > 0) {
      data[months[0]].soldeInitial = runningBalance;
    }

    // Créer un map des paiements réels par opportunité
    const paymentsByOpportunity = new Map<string, Payment>();
    payments.forEach(payment => {
      if (payment.opportunityId) {
        paymentsByOpportunity.set(payment.opportunityId, payment);
      }
    });

    // Pour les opportunités finalisées, utiliser les dépenses et notes de débours réelles
    (forecast?.finalizedExpenses || []).forEach(expense => {
      if (!expense.invoiceDate || !expense.opportunityId) return;
      const expenseDate = new Date(expense.invoiceDate);
      const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      if (data[monthKey]) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        data[monthKey].decaissements += amount;
      }
    });

    // Ajouter les notes de débours des opportunités finalisées comme décaissements
    (forecast?.finalizedDeboursNotes || []).forEach(debours => {
      const deboursDate = new Date(debours.issueDate);
      const monthKey = `${deboursDate.getFullYear()}-${String(deboursDate.getMonth() + 1).padStart(2, '0')}`;
      if (data[monthKey]) {
        data[monthKey].decaissements += Number(debours.totalAmount) || 0;
      }
    });

    // Traiter les encaissements prévisionnels (opportunités sans paiement réel et non finalisées)
    forecast?.opportunities.forEach(opp => {
      if (!opp.expectedPaymentDate || !opp.amount) return;
      
      // Ignorer les opportunités finalisées (elles utilisent les données réelles)
      if (opp.stage === 'FINALIZED') {
        return;
      }
      
      // Vérifier si cette opportunité a déjà un paiement réel
      const realPayment = paymentsByOpportunity.get(opp.id);
      if (realPayment) {
        // Si un paiement réel existe, on l'utilise à la place du prévisionnel
        return;
      }
      
      const paymentDate = new Date(opp.expectedPaymentDate);
      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (data[monthKey]) {
        data[monthKey].encaissementsPrevisionnels += opp.amount;
        
        // Calculer les taxes pour les paiements prévisionnels (mois +1, au 30)
        const taxRate = opp.taxRate ?? 0.27;
        const taxAmount = opp.amount * taxRate;
        // Les taxes sont imputées au 30 du mois suivant le paiement
        const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
        const taxMonthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`;
        if (data[taxMonthKey]) {
          data[taxMonthKey].taxes += taxAmount;
        }
      }
    });

    // Traiter les encaissements réels (paiements)
    payments.forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (data[monthKey]) {
        data[monthKey].encaissementsReels += payment.amount;
      }
    });

    // Traiter les décaissements (dépenses, exclure ceux déjà comptés pour les opportunités finalisées)
    const finalizedExpenseIds = new Set(
      (forecast?.finalizedExpenses || [])
        .filter(e => e.opportunityId && e.invoiceDate)
        .map(e => `${e.opportunityId!}-${e.invoiceDate!}`)
    );
    
    expenses.forEach(expense => {
      if (!expense.invoiceDate) return;
      
      // Ne pas compter deux fois les dépenses des opportunités finalisées
      if (expense.opportunityId && finalizedExpenseIds.has(`${expense.opportunityId}-${expense.invoiceDate}`)) {
        return;
      }
      
      const expenseDate = new Date(expense.invoiceDate);
      const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      if (data[monthKey]) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        data[monthKey].decaissements += amount;
      }
    });

    // Traiter les taxes (mois +1, au 30)
    payments.forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      // Les taxes sont imputées au 30 du mois suivant le paiement
      const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
      const monthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`;
      if (data[monthKey]) {
        data[monthKey].taxes += payment.taxAmount;
      }
    });

    // Calculer les soldes finaux
    months.forEach(monthKey => {
      const month = data[monthKey];
      month.soldeFinal = month.soldeInitial + month.encaissementsPrevisionnels + month.encaissementsReels - month.decaissements - month.taxes;
      // Le solde final devient le solde initial du mois suivant
      const nextIndex = months.indexOf(monthKey) + 1;
      if (nextIndex < months.length) {
        data[months[nextIndex]].soldeInitial = month.soldeFinal;
      }
    });

    return Object.values(data);
  }, [startDate, endDate, currentBalance, forecast, payments, expenses]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Mois
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Solde initial
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Encaissements prévisionnels
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Encaissements réels
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Décaissements
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Taxes
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Solde final
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {monthlyData.map((month) => (
            <tr key={month.monthKey} className={month.soldeFinal < 0 ? 'bg-red-50' : ''}>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                {month.month}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-600">
                {formatCurrency(month.soldeInitial)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                {formatCurrency(month.encaissementsPrevisionnels)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-700 font-medium">
                {formatCurrency(month.encaissementsReels)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">
                {formatCurrency(month.decaissements)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-600">
                {formatCurrency(month.taxes)}
              </td>
              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${month.soldeFinal < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                {formatCurrency(month.soldeFinal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

