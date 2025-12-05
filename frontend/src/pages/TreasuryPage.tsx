import { useEffect, useState, useMemo } from 'react';
import { 
  AdjustmentsHorizontalIcon,
  CurrencyEuroIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/apiClient';
import { treasuryService, TreasuryForecast } from '../services/treasuryService';
import { paymentService, Payment } from '../services/paymentService';
import { expensesService } from '../services/expensesService';
import { TreasuryMonthlyView } from '../components/TreasuryMonthlyView';
import { PaymentModal } from '../components/PaymentModal';
import { BalanceEditor } from '../components/BalanceEditor';

type Opportunity = {
  id: string;
  title: string;
  stage: string;
  amount?: number;
  expectedPaymentDate?: string;
  taxRate?: number;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

export function TreasuryPage() {
  const [period, setPeriod] = useState<3 | 6 | 12 | 'custom'>(6);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [forecast, setForecast] = useState<TreasuryForecast | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  const { startDate, endDate } = useMemo(() => {
    // Si période personnalisée, vérifier que les deux dates sont valides
    if (period === 'custom') {
      // Si les deux dates sont définies et valides
      if (customStartDate && customEndDate && customStartDate.length === 10 && customEndDate.length === 10) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        // Vérifier que les dates sont valides
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
          // S'assurer que la date de fin est à la fin de la journée
          end.setHours(23, 59, 59, 999);
          return { startDate: start, endDate: end };
        }
      }
      // Si les dates ne sont pas encore complètes, utiliser les valeurs par défaut temporairement
      // pour éviter les rechargements pendant la saisie
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setMonth(end.getMonth() + 6);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    
    // Sinon, utiliser les périodes prédéfinies
    const start = new Date();
    start.setDate(1); // Premier jour du mois
    start.setHours(0, 0, 0, 0);
    
    const end = new Date();
    if (period === 3) {
      end.setMonth(end.getMonth() + 3);
    } else if (period === 6) {
      end.setMonth(end.getMonth() + 6);
    } else if (period === 12) {
      end.setMonth(end.getMonth() + 12);
    } else {
      end.setMonth(end.getMonth() + 6);
    }
    // Dernier jour du mois de fin
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
    
    return { startDate: start, endDate: end };
  }, [period, customStartDate, customEndDate]);

  // Charger les données initiales
  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Seulement au montage du composant

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculer la date de début pour récupérer les paiements du mois précédent
      // (pour inclure les taxes qui tombent dans la période)
      const prevMonthStart = new Date(startDate);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
      prevMonthStart.setDate(1);
      
      const [balanceRes, forecastRes, paymentsRes, expensesRes, opportunitiesRes, prevMonthPaymentsRes] = await Promise.all([
        treasuryService.getBalance().catch(() => ({ balance: 0, isManual: false, date: new Date().toISOString() })),
        treasuryService.getForecast(
          startDate.toISOString(),
          endDate.toISOString()
        ).catch(() => ({ opportunities: [], payments: [], expenses: [], taxPayments: {} })),
        paymentService.getAll({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }).catch(() => []),
        // Récupérer toutes les dépenses (vérifiées ET prévisionnelles) dans la période
        expensesService.getAll({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }).then(expenses => {
          // Filtrer pour garder les dépenses vérifiées OU les dépenses prévisionnelles
          return expenses.filter((e: any) => e.status === 'VERIFIED' || e.isForecast === true);
        }).catch(() => []),
        api.get('/api/opportunities', {
          params: { limit: 1000 }
        }).catch(() => ({ data: { items: [], data: [] } })),
        // Récupérer les paiements du mois précédent pour calculer les taxes qui tombent dans la période
        paymentService.getAll({
          startDate: prevMonthStart.toISOString(),
          endDate: startDate.toISOString()
        }).catch(() => [])
      ]);

      // Combiner les paiements de la période et du mois précédent
      const allPayments = [...(prevMonthPaymentsRes || []), ...(paymentsRes || [])];
      
      setCurrentBalance(balanceRes?.balance || 0);
      setForecast(forecastRes || { opportunities: [], payments: [], expenses: [], taxPayments: {} });
      setPayments(allPayments);
      setExpenses(expensesRes || []);
      setOpportunities(opportunitiesRes?.data?.items || opportunitiesRes?.data?.data || []);
      
      console.log('TreasuryPage - Données chargées:', {
        balance: balanceRes.balance,
        forecastOpportunities: forecastRes?.opportunities?.length || 0,
        forecastPayments: forecastRes?.payments?.length || 0,
        payments: paymentsRes?.length || 0,
        expenses: expensesRes?.length || 0,
        opportunities: opportunitiesRes.data.items?.length || opportunitiesRes.data.data?.length || 0
      });
    } catch (error) {
      console.error('Erreur chargement données trésorerie:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceUpdate = async () => {
    await loadData();
  };

  const handlePaymentSuccess = async () => {
    await loadData();
  };

  const handleMarkAsPaid = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowPaymentModal(true);
  };

  // Préparer les données pour le graphique
  const chartData = useMemo(() => {
    if (!forecast) {
      console.log('TreasuryPage: forecast is null');
      return [];
    }
    
    console.log('TreasuryPage: forecast data', {
      opportunities: forecast.opportunities?.length || 0,
      payments: forecast.payments?.length || 0,
      expenses: forecast.expenses?.length || 0
    });
    
    const monthlyData: Record<string, any> = {};
    // Le solde de référence est le solde actuel (currentBalance)
    // C'est le solde à jour J calculé automatiquement ou défini manuellement
    // Il sert de point de départ pour les projections mensuelles

    // Générer tous les mois dans la période
    const current = new Date(startDate);
    current.setDate(1);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    while (current <= end) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = {
        month: current.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        monthKey: monthKey,
        solde: 0, // Sera calculé plus tard
        encaissementsPrevisionnels: 0,
        encaissementsReels: 0,
        decaissements: 0,
        taxes: 0
      };
      current.setMonth(current.getMonth() + 1);
    }

    // Créer un map des paiements réels par opportunité pour éviter les doublons
    const paymentsByOpportunity = new Map<string, Payment>();
    (payments || []).forEach(payment => {
      if (payment.opportunityId) {
        paymentsByOpportunity.set(payment.opportunityId, payment);
      }
    });

    // Créer un set des opportunités finalisées
    const finalizedOppIds = new Set(
      (forecast?.opportunities || [])
        .filter(opp => opp.stage === 'FINALIZED' && opp.id)
        .map(opp => opp.id!)
    );

    // Pour les opportunités finalisées, utiliser les dépenses et notes de débours réelles
    // au lieu des prévisionnels
    (forecast?.finalizedExpenses || []).forEach(expense => {
      if (!expense.invoiceDate || !expense.opportunityId) return;
      const expenseDate = new Date(expense.invoiceDate);
      const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        monthlyData[monthKey].decaissements += amount;
      }
    });

    // Ajouter les notes de débours des opportunités finalisées comme décaissements
    (forecast?.finalizedDeboursNotes || []).forEach(debours => {
      const deboursDate = new Date(debours.issueDate);
      const monthKey = `${deboursDate.getFullYear()}-${String(deboursDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].decaissements += Number(debours.totalAmount) || 0;
      }
    });

    // Ajouter les encaissements prévisionnels (opportunités sans paiement réel et non finalisées)
    (forecast?.opportunities || []).forEach(opp => {
      if (!opp.expectedPaymentDate || !opp.amount) return;
      
      // Ignorer les opportunités finalisées (elles utilisent les données réelles)
      if (opp.stage === 'FINALIZED') {
        return;
      }
      
      // Vérifier si cette opportunité a déjà un paiement réel
      const realPayment = paymentsByOpportunity.get(opp.id);
      if (realPayment) {
        // Si un paiement réel existe, on ne compte pas le prévisionnel
        return;
      }
      
      try {
        const paymentDate = new Date(opp.expectedPaymentDate);
        if (isNaN(paymentDate.getTime())) {
          console.warn('Date invalide pour opportunité:', opp.id, opp.expectedPaymentDate);
          return;
        }
        
        const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].encaissementsPrevisionnels += Number(opp.amount) || 0;
          
          // Calculer les taxes pour les paiements prévisionnels (mois +1, au 30)
          const taxRate = opp.taxRate ?? 0.27;
          const taxAmount = (Number(opp.amount) || 0) * taxRate;
          // Les taxes sont imputées au 30 du mois suivant le paiement
          const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
          const taxMonthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyData[taxMonthKey]) {
            monthlyData[taxMonthKey].taxes += taxAmount;
          }
        }
      } catch (error) {
        console.error('Erreur traitement opportunité prévisionnelle:', opp.id, error);
      }
    });

    // Ajouter les encaissements réels
    (payments || []).forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].encaissementsReels += payment.amount;
      }
    });

    // Ajouter les décaissements (exclure ceux déjà comptés pour les opportunités finalisées)
    const finalizedExpenseIds = new Set(
      (forecast?.finalizedExpenses || [])
        .filter(e => e.opportunityId && e.invoiceDate)
        .map(e => `${e.opportunityId!}-${e.invoiceDate!}`)
    );
    
    (expenses || []).forEach(expense => {
      if (!expense.invoiceDate) return;
      
      // Ne pas compter deux fois les dépenses des opportunités finalisées
      if (expense.opportunityId && finalizedExpenseIds.has(`${expense.opportunityId}-${expense.invoiceDate}`)) {
        return;
      }
      
      const expenseDate = new Date(expense.invoiceDate);
      const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        monthlyData[monthKey].decaissements += amount;
      }
    });

    // Ajouter les taxes des paiements réels (mois +1, au 30)
    // Inclure tous les paiements (y compris ceux du mois précédent) pour calculer les taxes
    (payments || []).forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      // Les taxes sont imputées au 30 du mois suivant le paiement
      const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
      const monthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`;
      // Inclure les taxes même si elles sont en dehors de la période initiale
      // (car elles impactent la période affichée)
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].taxes += payment.taxAmount;
      }
    });

    // Calculer les soldes finaux
    // Le solde initial du premier mois est le solde de référence (currentBalance)
    const sortedMonths = Object.values(monthlyData).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    
    return sortedMonths.map((month, index, array) => {
      const totalEncaissements = month.encaissementsPrevisionnels + month.encaissementsReels;
      // Les taxes sont des décaissements, donc on les soustrait
      const totalDecaissements = month.decaissements + month.taxes;
      
      if (index === 0) {
        // Premier mois : solde initial = solde de référence (currentBalance)
        month.soldeInitial = currentBalance;
        month.solde = currentBalance + totalEncaissements - totalDecaissements;
      } else {
        // Mois suivants : solde initial = solde final du mois précédent
        month.soldeInitial = array[index - 1].solde;
        month.solde = array[index - 1].solde + totalEncaissements - totalDecaissements;
      }
      
      // Pour l'affichage dans le graphique, on garde taxes séparé mais on peut aussi créer un total décaissements
      month.totalDecaissements = totalDecaissements;
      return month;
    });
  }, [forecast, payments, expenses, currentBalance, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Opportunités avec paiement ou prévisionnel
  const opportunitiesWithPayment = useMemo(() => {
    return (opportunities || [])
      .filter(opp => opp.expectedPaymentDate || (payments || []).some(p => p.opportunityId === opp.id))
      .map(opp => {
        const payment = (payments || []).find(p => p.opportunityId === opp.id);
        return {
          ...opp,
          hasPayment: !!payment,
          paymentDate: payment?.paymentDate,
          expectedPaymentDate: opp.expectedPaymentDate
        };
      })
      .sort((a, b) => {
        const dateA = a.paymentDate || a.expectedPaymentDate || '';
        const dateB = b.paymentDate || b.expectedPaymentDate || '';
        return dateB.localeCompare(dateA);
      });
  }, [opportunities, payments]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Trésorerie</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowBalanceEditor(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
            <span>Définir le solde</span>
          </button>
        </div>
      </div>

      {/* Solde actuel */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-slate-500">Solde de référence (à jour J)</h2>
            <p className={`text-3xl font-bold mt-1 ${currentBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(currentBalance)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ce solde sert de point de départ pour les projections mensuelles
            </p>
          </div>
          <CurrencyEuroIcon className="h-12 w-12 text-slate-300" />
        </div>
      </div>

      {/* Filtres période */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-slate-700">Période :</label>
          <button
            onClick={() => {
              setPeriod(3);
              void loadData();
            }}
            className={`px-3 py-1 rounded ${period === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            3 mois
          </button>
          <button
            onClick={() => {
              setPeriod(6);
              void loadData();
            }}
            className={`px-3 py-1 rounded ${period === 6 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            6 mois
          </button>
          <button
            onClick={() => {
              setPeriod(12);
              void loadData();
            }}
            className={`px-3 py-1 rounded ${period === 12 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            12 mois
          </button>
          <button
            onClick={() => {
              setPeriod('custom');
              // Initialiser les dates si elles sont vides
              if (!customStartDate) {
                const today = new Date();
                today.setDate(1);
                setCustomStartDate(today.toISOString().split('T')[0]);
              }
              if (!customEndDate) {
                const end = new Date();
                end.setMonth(end.getMonth() + 6);
                setCustomEndDate(end.toISOString().split('T')[0]);
              }
            }}
            className={`px-3 py-1 rounded ${period === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Personnalisée
          </button>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  // Si la date de fin est avant la date de début, la mettre à jour
                  if (customEndDate && e.target.value > customEndDate) {
                    setCustomEndDate(e.target.value);
                  }
                }}
                onBlur={() => {
                  // Recharger les données seulement quand on sort du champ
                  if (customStartDate && customEndDate && customStartDate.length === 10 && customEndDate.length === 10) {
                    void loadData();
                  }
                }}
                className="px-3 py-1 border border-slate-300 rounded text-sm"
              />
              <span className="text-sm text-slate-600">à</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  // Si la date de fin est avant la date de début, mettre à jour la date de début
                  if (customStartDate && e.target.value < customStartDate) {
                    setCustomStartDate(e.target.value);
                  }
                }}
                onBlur={() => {
                  // Recharger les données seulement quand on sort du champ
                  if (customStartDate && customEndDate && customStartDate.length === 10 && customEndDate.length === 10) {
                    void loadData();
                  }
                }}
                className="px-3 py-1 border border-slate-300 rounded text-sm"
              />
            </>
          )}
        </div>
      </div>

      {/* Graphique */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Évolution de la trésorerie</h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value: number, name: string) => {
                // Pour les taxes et décaissements, afficher comme valeurs négatives dans le tooltip
                if (name === 'Taxes' || name === 'Décaissements') {
                  return formatCurrency(-Math.abs(value));
                }
                return formatCurrency(value);
              }}
            />
            <Legend />
            <Bar dataKey="encaissementsPrevisionnels" fill="#10b981" name="Encaissements prévisionnels" />
            <Bar dataKey="encaissementsReels" fill="#059669" name="Encaissements réels" />
            <Bar dataKey="decaissements" fill="#ef4444" name="Décaissements" stackId="decaissements" />
            <Bar dataKey="taxes" fill="#f59e0b" name="Taxes" stackId="decaissements" />
            <Line type="monotone" dataKey="solde" stroke="#3b82f6" strokeWidth={2} name="Solde" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau mensuel */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Vue mensuelle détaillée</h2>
        </div>
        <TreasuryMonthlyView
          startDate={startDate}
          endDate={endDate}
          currentBalance={currentBalance}
          forecast={forecast}
          payments={payments}
          expenses={expenses}
        />
      </div>

      {/* Liste des opportunités */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Opportunités</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {opportunitiesWithPayment.map((opp) => (
              <div
                key={opp.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-medium text-slate-900">{opp.title}</h3>
                    {opp.amount && (
                      <span className="text-sm text-slate-600">
                        {formatCurrency(opp.amount)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-slate-500">
                    {opp.hasPayment ? (
                      <>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span>Payé le {new Date(opp.paymentDate!).toLocaleDateString('fr-FR')}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center space-x-1">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                          <span>Prévisionnel : {opp.expectedPaymentDate ? new Date(opp.expectedPaymentDate).toLocaleDateString('fr-FR') : '-'}</span>
                        </span>
                      </>
                    )}
                    {opp.company && (
                      <span>{opp.company.name}</span>
                    )}
                  </div>
                </div>
                {!opp.hasPayment && (
                  <button
                    onClick={() => handleMarkAsPaid(opp)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                  >
                    Marquer comme payé
                  </button>
                )}
              </div>
            ))}
            {opportunitiesWithPayment.length === 0 && (
              <p className="text-center text-slate-500 py-8">Aucune opportunité avec paiement prévisionnel ou réel</p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <BalanceEditor
        isOpen={showBalanceEditor}
        onClose={() => setShowBalanceEditor(false)}
        currentBalance={currentBalance}
        onSuccess={handleBalanceUpdate}
      />

      {selectedOpportunity && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedOpportunity(null);
          }}
          opportunityId={selectedOpportunity.id}
          opportunityTitle={selectedOpportunity.title}
          opportunityAmount={selectedOpportunity.amount}
          opportunityTaxRate={selectedOpportunity.taxRate}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

