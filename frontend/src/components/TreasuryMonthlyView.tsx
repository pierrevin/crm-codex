import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'encaissements' | 'decaissements'>('all');

  const toggleRow = (monthKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedRows(newExpanded);
  };

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

    // Les notes de débours finalisées ne doivent PAS être comptées ici car :
    // 1. Si elles ont un paiement réel, celui-ci est déjà compté dans encaissements réels
    // 2. Si elles n'ont pas de paiement mais une expectedPaymentDate, elles sont dans deboursNotesForecast
    // Les dépenses liées aux notes de débours sont déjà comptées dans les décaissements

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

    // Traiter les notes de débours en prévisionnel (comme les opportunités)
    // Utiliser le montant totalFrais (calculé depuis les dépenses) et non totalAmount
    (forecast?.deboursNotesForecast || []).forEach(debours => {
      if (!debours.expectedPaymentDate || !debours.totalFrais) return;
      
      // Vérifier si cette note de débours a déjà un paiement réel
      const realPayment = payments.find(p => p.deboursNoteId === debours.id);
      if (realPayment) {
        // Si un paiement réel existe, on ne compte pas le prévisionnel (il sera compté dans encaissements réels)
        return;
      }
      
      const paymentDate = new Date(debours.expectedPaymentDate);
      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (data[monthKey]) {
        // Utiliser totalFrais (montant des dépenses récupérées) et non totalAmount
        data[monthKey].encaissementsPrevisionnels += debours.totalFrais;
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

  // Filtrer les données selon le filtre de type
  const filteredMonthlyData = useMemo(() => {
    if (filterType === 'all') return monthlyData;
    return monthlyData.filter(month => {
      if (filterType === 'encaissements') {
        return month.encaissementsPrevisionnels > 0 || month.encaissementsReels > 0;
      } else if (filterType === 'decaissements') {
        return month.decaissements > 0 || month.taxes > 0;
      }
      return true;
    });
  }, [monthlyData, filterType]);

  // Obtenir les détails d'un mois pour l'affichage expansible
  const getMonthDetails = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const details = {
      encaissements: [] as Array<{ type: string; label: string; amount: number }>,
      decaissements: [] as Array<{ type: string; label: string; amount: number }>
    };

    // Encaissements prévisionnels - opportunités
    forecast?.opportunities.forEach(opp => {
      if (!opp.expectedPaymentDate || !opp.amount || opp.stage === 'FINALIZED') return;
      const paymentDate = new Date(opp.expectedPaymentDate);
      if (paymentDate >= monthStart && paymentDate <= monthEnd) {
        const hasRealPayment = payments.some(p => p.opportunityId === opp.id && 
          new Date(p.paymentDate) >= monthStart && new Date(p.paymentDate) <= monthEnd);
        if (!hasRealPayment) {
          details.encaissements.push({
            type: 'previsionnel',
            label: opp.title || 'Opportunité',
            amount: Number(opp.amount)
          });
        }
      }
    });

    // Encaissements prévisionnels - notes de débours
    forecast?.deboursNotesForecast.forEach(debours => {
      if (!debours.expectedPaymentDate || !debours.totalFrais) return;
      const paymentDate = new Date(debours.expectedPaymentDate);
      if (paymentDate >= monthStart && paymentDate <= monthEnd) {
        const hasRealPayment = payments.some(p => p.deboursNoteId === debours.id &&
          new Date(p.paymentDate) >= monthStart && new Date(p.paymentDate) <= monthEnd);
        if (!hasRealPayment) {
          details.encaissements.push({
            type: 'debours',
            label: 'Note de débours',
            amount: Number(debours.totalFrais)
          });
        }
      }
    });

    // Encaissements réels
    payments.forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      if (paymentDate >= monthStart && paymentDate <= monthEnd) {
        details.encaissements.push({
          type: 'reel',
          label: payment.opportunity?.title || payment.deboursNote?.title || 'Paiement',
          amount: payment.amount
        });
      }
    });

    // Décaissements - dépenses
    expenses.forEach(expense => {
      if (!expense.invoiceDate) return;
      const expenseDate = new Date(expense.invoiceDate);
      if (expenseDate >= monthStart && expenseDate <= monthEnd) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        details.decaissements.push({
          type: 'depense',
          label: 'Dépense',
          amount: Number(amount)
        });
      }
    });

    // Taxes (du mois suivant les paiements)
    payments.forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      const taxDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 30);
      if (taxDate >= monthStart && taxDate <= monthEnd) {
        details.decaissements.push({
          type: 'taxe',
          label: `Taxes (paiement ${new Date(payment.paymentDate).toLocaleDateString('fr-FR')})`,
          amount: payment.taxAmount
        });
      }
    });

    return details;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div>
      {/* Filtres */}
      <div className="mb-4 flex items-center space-x-4">
        <label className="text-sm font-medium text-slate-700">Filtrer par type :</label>
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 rounded text-sm ${filterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilterType('encaissements')}
          className={`px-3 py-1 rounded text-sm ${filterType === 'encaissements' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Encaissements
        </button>
        <button
          onClick={() => setFilterType('decaissements')}
          className={`px-3 py-1 rounded text-sm ${filterType === 'decaissements' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Décaissements
        </button>
      </div>

      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '40px' }}>
              {/* Espace pour l'icône d'expansion */}
            </th>
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
          {filteredMonthlyData.map((month) => {
            const isExpanded = expandedRows.has(month.monthKey);
            const details = getMonthDetails(month.monthKey);
            const hasDetails = details.encaissements.length > 0 || details.decaissements.length > 0;

            return (
              <>
                <tr key={month.monthKey} className={month.soldeFinal < 0 ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {hasDetails && (
                      <button
                        onClick={() => toggleRow(month.monthKey)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </td>
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
                {isExpanded && hasDetails && (
                  <tr key={`${month.monthKey}-detail`} className="bg-slate-50">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Encaissements */}
                        <div>
                          <h4 className="font-semibold text-green-700 mb-2">Encaissements</h4>
                          <div className="space-y-1 text-sm">
                            {details.encaissements.length > 0 ? (
                              details.encaissements.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span className="text-slate-600">{item.label}</span>
                                  <span className="font-medium text-green-600">{formatCurrency(item.amount)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">Aucun encaissement</p>
                            )}
                          </div>
                        </div>
                        {/* Décaissements */}
                        <div>
                          <h4 className="font-semibold text-red-700 mb-2">Décaissements</h4>
                          <div className="space-y-1 text-sm">
                            {details.decaissements.length > 0 ? (
                              details.decaissements.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span className="text-slate-600">{item.label}</span>
                                  <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">Aucun décaissement</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

