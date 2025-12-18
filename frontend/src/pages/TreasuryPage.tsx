import { useEffect, useState, useMemo } from 'react';
import { 
  AdjustmentsHorizontalIcon,
  CurrencyEuroIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import api from '../services/apiClient';
import { treasuryService, TreasuryForecast } from '../services/treasuryService';
import { paymentService, Payment } from '../services/paymentService';
import { expensesService } from '../services/expensesService';
import { TreasuryMonthlyView } from '../components/TreasuryMonthlyView';
import { PaymentModal } from '../components/PaymentModal';
import { BalanceEditor } from '../components/BalanceEditor';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const toDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isBeforeDay = (a: Date, b: Date) => {
  // Compare uniquement sur le jour (pas l'heure), pour éviter les effets de timezone.
  return toDateKey(a) < toDateKey(b);
};

// Composant Tooltip personnalisé pour afficher les détails
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0]?.payload;
  if (!data) return null;

  // Sur la vue journalière, le `label` peut être ambigu/incomplet selon la configuration de l'axe.
  // On préfère afficher une date fiable quand elle est disponible dans le payload.
  const headerLabel = (() => {
    const d = data?.date ? new Date(data.date) : null;
    if (d && !isNaN(d.getTime())) {
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return label;
  })();

  const encaissementsPrevisionnels = data.encaissementsPrevisionnelOpportunites || 0;
  const encaissementsPrevisionnelDebours = data.encaissementsPrevisionnelDebours || 0;
  const encaissementsReels = data.encaissementsReels || 0;
  const totalEncaissements = encaissementsPrevisionnels + encaissementsPrevisionnelDebours + encaissementsReels;

  const decaissementsDepenses = data.decaissementsDepenses || 0;
  const taxes = data.taxes || 0;
  const totalDecaissements = decaissementsDepenses + taxes;

  const solde = data.solde || 0;

  const anchor = data.anchorInfo as
    | {
        label: string;
        encaissements: number;
        encaissementsVentes: number;
        encaissementsDebours: number;
        decaissements: number;
        taxes: number;
      }
    | undefined;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4">
      <p className="font-semibold text-slate-900 mb-3">{headerLabel}</p>
      
      <div className="space-y-3">
        <div>
          <p className="font-medium text-green-700 mb-1">
            Encaissements {formatCurrency(totalEncaissements)}
          </p>
          <div className="pl-3 text-sm space-y-0.5">
            {encaissementsPrevisionnels > 0 && (
              <p className="text-slate-600">
                &nbsp;&nbsp;Prévisionnel : {formatCurrency(encaissementsPrevisionnels)}
              </p>
            )}
            {encaissementsPrevisionnelDebours > 0 && (
              <p className="text-slate-600">
                &nbsp;&nbsp;Note de débours : {formatCurrency(encaissementsPrevisionnelDebours)}
              </p>
            )}
            {encaissementsReels > 0 && (
              <p className="text-slate-600">
                &nbsp;&nbsp;Réel : {formatCurrency(encaissementsReels)}
              </p>
            )}
            {totalEncaissements === 0 && (
              <p className="text-slate-400 italic">Aucun encaissement</p>
            )}
          </div>
        </div>

        <div>
          <p className="font-medium text-red-700 mb-1">
            Décaissements {formatCurrency(totalDecaissements)}
          </p>
          <div className="pl-3 text-sm space-y-0.5">
            {decaissementsDepenses > 0 && (
              <p className="text-slate-600">
                &nbsp;&nbsp;Dépenses : {formatCurrency(decaissementsDepenses)}
              </p>
            )}
            {taxes > 0 && (
              <p className="text-slate-600">
                &nbsp;&nbsp;Taxes m-1 : {formatCurrency(taxes)}
              </p>
            )}
            {totalDecaissements === 0 && (
              <p className="text-slate-400 italic">Aucun décaissement</p>
            )}
          </div>
        </div>

        {anchor && (
          <div className="pt-2 border-t border-slate-200">
            <p className="font-medium text-slate-900 mb-1">
              Avant solde manuel ({anchor.label})
            </p>
            <div className="pl-3 text-sm space-y-0.5">
              <p className="text-slate-600">
                &nbsp;&nbsp;Encaissements : {formatCurrency(anchor.encaissements)}
              </p>
              {(anchor.encaissementsVentes > 0 || anchor.encaissementsDebours > 0) && (
                <p className="text-slate-500">
                  &nbsp;&nbsp;&nbsp;&nbsp;Ventes : {formatCurrency(anchor.encaissementsVentes)} · Débours : {formatCurrency(anchor.encaissementsDebours)}
                </p>
              )}
              <p className="text-slate-600">
                &nbsp;&nbsp;Décaissements : {formatCurrency(anchor.decaissements)}
              </p>
              {anchor.taxes > 0 && (
                <p className="text-slate-600">
                  &nbsp;&nbsp;Taxes : {formatCurrency(anchor.taxes)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-200">
          <p className="font-semibold text-slate-900">
            Solde : {formatCurrency(solde)}
          </p>
        </div>
      </div>
    </div>
  );
};

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
  const [viewGranularity, setViewGranularity] = useState<'month' | 'day'>('month');
  // Solde "à jour J" (référence): soit manuel, soit calculé par l'API
  const [balanceToday, setBalanceToday] = useState<number>(0);
  const [balanceTodayDate, setBalanceTodayDate] = useState<string | null>(null);
  // Solde au début de la période affichée (point de départ des projections/graph/tableau)
  const [periodInitialBalance, setPeriodInitialBalance] = useState<number>(0);
  // Date d'ancrage de projection (par défaut: dernier solde manuel si disponible)
  const [projectionAnchorDate, setProjectionAnchorDate] = useState<Date | null>(null);
  const [balanceIsManual, setBalanceIsManual] = useState<boolean>(false);
  const [forecast, setForecast] = useState<TreasuryForecast | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  // Filtre des étapes du tunnel pour le prévisionnel (opportunités)
  // Vue par défaut: Gagné + Finalisé (Proposition optionnelle)
  const [selectedStages, setSelectedStages] = useState<Set<string>>(
    () => new Set(['CLOSED_WON', 'FINALIZED'])
  );

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
      // Si les dates ne sont pas encore complètes, utiliser les dates par défaut (6 mois)
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

  // Charger les données au montage initial
  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les données quand la période change
  useEffect(() => {
    if (period !== 'custom') {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  
  // Charger les données quand les dates personnalisées sont complètes (avec debounce)
  useEffect(() => {
    if (period === 'custom') {
      if (!customStartDate || !customEndDate || customStartDate.length !== 10 || customEndDate.length !== 10) {
        return; // Ne pas recharger pendant la saisie
      }
      
      const timer = setTimeout(() => {
        void loadData();
      }, 500); // Debounce de 500ms
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStartDate, customEndDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculer la date de début pour récupérer les paiements AVANT la période
      // (pour inclure les taxes qui tombent dans la période et calculer le solde initial)
      const beforePeriodStart = new Date(startDate);
      beforePeriodStart.setMonth(beforePeriodStart.getMonth() - 12); // Récupérer les 12 derniers mois
      beforePeriodStart.setDate(1);
      
      const [balanceRes, forecastRes, paymentsRes, expensesRes, opportunitiesRes, prevMonthPaymentsRes] = await Promise.all([
        treasuryService.getBalance().catch(() => ({ balance: 0, isManual: false, date: new Date().toISOString(), notes: null })),
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
        // Récupérer les paiements AVANT la période pour calculer le solde initial et les taxes
        paymentService.getAll({
          startDate: beforePeriodStart.toISOString(),
          endDate: startDate.toISOString()
        }).catch(() => [])
      ]);

      // Combiner les paiements de la période et avant la période
      const allPayments = [...(prevMonthPaymentsRes || []), ...(paymentsRes || [])];
      
      // Solde de référence "à jour J": toujours celui renvoyé par l'API (manuel si défini récemment)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const computedBalanceToday = balanceRes?.balance || 0;
      
      // Mode par défaut: projeter depuis le dernier solde manuel disponible (ancre), et ignorer l'historique avant.
      // Si aucun solde manuel n'existe, on retombe sur l'ancien comportement (reconstruction au startDate).
      // Ancre de projection:
      // - si l'API renvoie `lastManual`, on l'utilise
      // - sinon, si `isManual === true`, alors `balanceRes.balance` + `balanceRes.date` sont déjà le dernier manuel (récent)
      const lastManualFromApi = (balanceRes as any)?.lastManual as { balance: number; date: string } | null | undefined;
      const lastManual =
        lastManualFromApi ??
        (balanceRes?.isManual && balanceRes?.date
          ? { balance: computedBalanceToday, date: balanceRes.date }
          : null);

      const anchor = lastManual?.date ? new Date(lastManual.date) : null;
      const hasAnchor = anchor && !isNaN(anchor.getTime());

      // Date effective de début de projection = max(startDate, anchorDate) si ancre présente
      const effectiveStart = hasAnchor
        ? new Date(Math.max(startDate.getTime(), (anchor as Date).getTime()))
        : new Date(startDate);
      effectiveStart.setHours(0, 0, 0, 0);

      // Solde initial de projection:
      // - si on a une ancre manuelle et qu'elle est >= startDate, le solde initial = solde manuel (ancre)
      // - sinon on reconstruit au startDate depuis le solde à jour J (ancien mode)
      let calculatedPeriodInitialBalance = computedBalanceToday;
      if (hasAnchor && (anchor as Date).getTime() >= startDate.getTime()) {
        calculatedPeriodInitialBalance = Number(lastManual!.balance) || 0;
      }
      
      if (!(hasAnchor && (anchor as Date).getTime() >= startDate.getTime()) && startDate < today) {
        // Date de début passée : il faut soustraire les mouvements entre startDate et aujourd'hui
        // pour retrouver le solde qu'on avait à startDate
        const pastPaymentsRes = await paymentService.getAll({
          startDate: startDate.toISOString(),
          endDate: today.toISOString()
        }).catch(() => []);
        
        const pastExpensesRes = await expensesService.getAll({
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        }).then(expenses => expenses.filter((e: any) => e.status === 'VERIFIED')).catch(() => []);
        
        // Pour remonter dans le temps : on soustrait les encaissements (qui augmentent le solde)
        // et on ajoute les décaissements (qui diminuent le solde), taxes incluses.
        // Taxes: uniquement sur les ventes (opportunités). Les notes de débours ont taxAmount=0 côté backend.
        const pastEncaissements = pastPaymentsRes.reduce((sum: number, p: Payment) => sum + parseFloat(p.amount.toString()), 0);
        const pastTaxes = pastPaymentsRes.reduce((sum: number, p: Payment) => sum + parseFloat((p.taxAmount ?? 0).toString()), 0);
        const pastDecaissements = pastExpensesRes.reduce((sum: number, e: any) => sum + parseFloat((e.amountTTC || e.amountHT || 0).toString()), 0);
        
        // Remonter dans le temps :
        // solde à startDate = solde aujourd'hui
        //   - encaissements depuis startDate
        //   + décaissements depuis startDate
        //   + taxes depuis startDate (car taxes diminuent le solde "aujourd'hui" dans l'API)
        calculatedPeriodInitialBalance = computedBalanceToday - pastEncaissements + pastDecaissements + pastTaxes;
      } else if (!(hasAnchor && (anchor as Date).getTime() >= startDate.getTime()) && startDate >= today) {
        // Date de début aujourd'hui ou future : le solde initial est le solde d'aujourd'hui
        calculatedPeriodInitialBalance = computedBalanceToday;
      }
      
      setBalanceToday(computedBalanceToday);
      setBalanceTodayDate(balanceRes?.date ?? null);
      setPeriodInitialBalance(calculatedPeriodInitialBalance);
      setProjectionAnchorDate(hasAnchor ? (anchor as Date) : null);
      setBalanceIsManual(balanceRes?.isManual || false);
      setForecast(forecastRes || { opportunities: [], payments: [], expenses: [], taxPayments: {} });
      setPayments(allPayments);
      setExpenses(expensesRes || []);
      setOpportunities(opportunitiesRes?.data?.items || opportunitiesRes?.data?.data || []);
      
      console.log('TreasuryPage - Données chargées:', {
        balanceToday: balanceRes.balance,
        calculatedPeriodInitialBalance,
        projectionAnchorDate: hasAnchor ? (anchor as Date).toISOString().split('T')[0] : null,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        period,
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

  // Calculer si la période dépasse 3 mois (pour limiter la vue journalière)
  const exceedsThreeMonths = useMemo(() => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 90; // Plus de 3 mois
  }, [startDate, endDate]);

  // Avertir si la vue jour dépasse 90 jours (mais permettre l'affichage)
  const showDayViewWarning = useMemo(() => {
    return viewGranularity === 'day' && exceedsThreeMonths;
  }, [viewGranularity, exceedsThreeMonths]);

  // Fonction pour construire les données journalières
  const buildDailyData = useMemo(() => {
    if (!forecast || viewGranularity !== 'day') return [];

    const dailyData: Record<string, any> = {};
    const startForProjectionRaw = projectionAnchorDate && projectionAnchorDate > startDate ? projectionAnchorDate : startDate;
    const startForProjection = new Date(startForProjectionRaw);
    startForProjection.setHours(0, 0, 0, 0);

    const current = new Date(startForProjection);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const dayKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      dailyData[dayKey] = {
        // Inclure l'année pour éviter toute ambiguïté sur les périodes longues (ex: 31 déc. 2025 vs 31 déc. 2026)
        day: current.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
        dayKey: dayKey,
        date: new Date(current),
        solde: 0,
        encaissementsPrevisionnels: 0,
        encaissementsPrevisionnelOpportunites: 0,
        encaissementsPrevisionnelDebours: 0,
        encaissementsReels: 0,
        decaissements: 0,
        decaissementsDepenses: 0,
        taxes: 0
      };
      current.setDate(current.getDate() + 1);
    }

    const paymentsByOpportunity = new Map<string, Payment>();
    (payments || []).forEach(payment => {
      if (payment.opportunityId) {
        paymentsByOpportunity.set(payment.opportunityId, payment);
      }
    });

    // Pour les opportunités finalisées, utiliser les dépenses réelles (finalizedExpenses)
    // et éviter de les compter deux fois avec `expenses`.
    const finalizedExpenseIds = new Set(
      (forecast?.finalizedExpenses || [])
        .filter((e: any) => e.opportunityId && e.invoiceDate)
        .map((e: any) => `${e.opportunityId!}-${e.invoiceDate!}`)
    );

    // Injecter d'abord les dépenses finalisées (réelles)
    (forecast?.finalizedExpenses || []).forEach((expense: any) => {
      if (!expense.invoiceDate) return;
      const expenseDate = new Date(expense.invoiceDate);
      if (isNaN(expenseDate.getTime())) return;
      if (isBeforeDay(expenseDate, startForProjection)) return;
      const dayKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;
      if (dailyData[dayKey]) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        dailyData[dayKey].decaissements += amount;
        dailyData[dayKey].decaissementsDepenses += amount;
      }
    });

    // Opportunités prévisionnelles (filtrées par étapes)
    (forecast?.opportunities || []).forEach(opp => {
      if (!opp.expectedPaymentDate || !opp.amount) return;
      if (opp.stage && !selectedStages.has(opp.stage)) return;
      if (opp.stage === 'FINALIZED') return;
      if (paymentsByOpportunity.has(opp.id)) return;

      try {
        const paymentDate = new Date(opp.expectedPaymentDate);
        paymentDate.setHours(0, 0, 0, 0);
        const dayKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(paymentDate.getDate()).padStart(2, '0')}`;
        if (dailyData[dayKey]) {
          const montant = Number(opp.amount) || 0;
          dailyData[dayKey].encaissementsPrevisionnels += montant;
          dailyData[dayKey].encaissementsPrevisionnelOpportunites += montant;

          // Taxes sur encaissements prévisionnels (ventes uniquement), imputées au 30 du mois suivant
          const taxRate = opp.taxRate ?? 0.27;
          const taxAmount = montant * taxRate;
          const taxDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 30);
          taxDate.setHours(0, 0, 0, 0);
          const taxDayKey = `${taxDate.getFullYear()}-${String(taxDate.getMonth() + 1).padStart(2, '0')}-${String(taxDate.getDate()).padStart(2, '0')}`;
          if (dailyData[taxDayKey]) {
            dailyData[taxDayKey].taxes += taxAmount;
          }
        }
      } catch (error) {
        console.error('Erreur traitement opportunité prévisionnelle jour:', opp.id, error);
      }
    });

    // Notes de débours prévisionnelles
    (forecast?.deboursNotesForecast || []).forEach(debours => {
      if (!debours.expectedPaymentDate || !debours.totalFrais) return;
      if (payments.find(p => p.deboursNoteId === debours.id)) return;

      try {
        const paymentDate = new Date(debours.expectedPaymentDate);
        paymentDate.setHours(0, 0, 0, 0);
        const dayKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(paymentDate.getDate()).padStart(2, '0')}`;
        if (dailyData[dayKey]) {
          const montant = Number(debours.totalFrais) || 0;
          dailyData[dayKey].encaissementsPrevisionnels += montant;
          dailyData[dayKey].encaissementsPrevisionnelDebours += montant;
        }
      } catch (error) {
        console.error('Erreur traitement note de débours jour:', debours.id, error);
      }
    });

    // Encaissements réels
    (payments || []).forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      if (isNaN(paymentDate.getTime())) return;
      // Ne compter le cash réel qu'après le début effectif de projection
      if (isBeforeDay(paymentDate, startForProjection)) return;
      const dayKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(paymentDate.getDate()).padStart(2, '0')}`;
      if (dailyData[dayKey]) {
        dailyData[dayKey].encaissementsReels += payment.amount;
      }
    });

    // Décaissements (dépenses)
    (expenses || []).forEach(expense => {
      if (!expense.invoiceDate) return;
      // Ne pas compter deux fois les dépenses des opportunités finalisées
      if (expense.opportunityId && finalizedExpenseIds.has(`${expense.opportunityId}-${expense.invoiceDate}`)) {
        return;
      }
      const expenseDate = new Date(expense.invoiceDate);
      if (isNaN(expenseDate.getTime())) return;
      if (isBeforeDay(expenseDate, startForProjection)) return;
      const dayKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;
      if (dailyData[dayKey]) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        dailyData[dayKey].decaissements += amount;
        dailyData[dayKey].decaissementsDepenses += amount;
      }
    });

    // Taxes (mois +1, au 30)
    (payments || []).forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      const taxDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 30);
      if (isNaN(taxDate.getTime())) return;
      // IMPORTANT: même si le paiement est avant l'ancre, la taxe peut tomber après l'ancre (cash out futur)
      if (isBeforeDay(taxDate, startForProjection)) return;
      const dayKey = `${taxDate.getFullYear()}-${String(taxDate.getMonth() + 1).padStart(2, '0')}-${String(taxDate.getDate()).padStart(2, '0')}`;
      if (dailyData[dayKey]) {
        dailyData[dayKey].taxes += payment.taxAmount;
      }
    });

    // Calculer les soldes
    const sortedDays = Object.values(dailyData).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    return sortedDays.map((day, index, array) => {
      const totalEncaissements = day.encaissementsPrevisionnels + day.encaissementsReels;
      const totalDecaissements = day.decaissements + day.taxes;

      if (index === 0) {
        day.soldeInitial = periodInitialBalance;
        day.solde = periodInitialBalance + totalEncaissements - totalDecaissements;
      } else {
        day.soldeInitial = array[index - 1].solde;
        day.solde = array[index - 1].solde + totalEncaissements - totalDecaissements;
      }
      return day;
    });
  }, [forecast, payments, expenses, periodInitialBalance, startDate, endDate, viewGranularity, projectionAnchorDate, selectedStages]);

  // Préparer les données pour le graphique (mensuel)
  const chartData = useMemo(() => {
    // Si vue jour, utiliser buildDailyData
    if (viewGranularity === 'day') {
      return buildDailyData;
    }

    // Sinon, construire les données mensuelles
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
    const startForProjectionRaw = projectionAnchorDate && projectionAnchorDate > startDate ? projectionAnchorDate : startDate;
    const startForProjection = new Date(startForProjectionRaw);
    startForProjection.setHours(0, 0, 0, 0);

    const current = new Date(startForProjection);
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
        encaissementsPrevisionnelOpportunites: 0, // Détail pour tooltip
        encaissementsPrevisionnelDebours: 0, // Détail pour tooltip
        encaissementsReels: 0,
        decaissements: 0,
        decaissementsDepenses: 0, // Détail pour tooltip
        taxes: 0,
        // Info optionnelle (tooltip) : mouvements AVANT l'ancre dans ce mois
        anchorInfo: null as null | {
          label: string;
          encaissements: number;
          encaissementsVentes: number;
          encaissementsDebours: number;
          decaissements: number;
          taxes: number;
        }
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
        monthlyData[monthKey].decaissementsDepenses += amount;
      }
    });

    // Ajouter les notes de débours en prévisionnel comme encaissements (comme les opportunités)
    // Utiliser le montant totalFrais (calculé depuis les dépenses) et non totalAmount
    (forecast?.deboursNotesForecast || []).forEach(debours => {
      if (!debours.expectedPaymentDate || !debours.totalFrais) return;
      
      // Vérifier si cette note de débours a déjà un paiement réel
      const realPayment = payments.find(p => p.deboursNoteId === debours.id);
      if (realPayment) {
        // Si un paiement réel existe, on ne compte pas le prévisionnel (il sera compté dans encaissements réels)
        return;
      }
      
      try {
        const paymentDate = new Date(debours.expectedPaymentDate);
        if (isNaN(paymentDate.getTime())) {
          console.warn('Date invalide pour note de débours:', debours.id, debours.expectedPaymentDate);
          return;
        }
        // Ne pas compter le prévisionnel avant l'ancre de projection
        if (paymentDate < startForProjection) return;
        
        const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          // Utiliser totalFrais (montant des dépenses récupérées) et non totalAmount
          const montantDebours = Number(debours.totalFrais) || 0;
          monthlyData[monthKey].encaissementsPrevisionnels += montantDebours;
          monthlyData[monthKey].encaissementsPrevisionnelDebours += montantDebours;
        }
      } catch (error) {
        console.error('Erreur traitement note de débours prévisionnelle:', debours.id, error);
      }
    });

    // Ajouter les encaissements prévisionnels (opportunités sans paiement réel et non finalisées, filtrées par étapes)
    (forecast?.opportunities || []).forEach(opp => {
      if (!opp.expectedPaymentDate || !opp.amount) return;
      if (opp.stage && !selectedStages.has(opp.stage)) return;
      
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
        if (paymentDate < startForProjection) return;
        
        const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData[monthKey]) {
          const montantOpp = Number(opp.amount) || 0;
          monthlyData[monthKey].encaissementsPrevisionnels += montantOpp;
          monthlyData[monthKey].encaissementsPrevisionnelOpportunites += montantOpp;
          
          // Calculer les taxes pour les paiements prévisionnels (mois +1, au 30)
          const taxRate = opp.taxRate ?? 0.27;
          const taxAmount = montantOpp * taxRate;
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
      if (isNaN(paymentDate.getTime())) return;
      if (isBeforeDay(paymentDate, startForProjection)) return;
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
      if (isNaN(expenseDate.getTime())) return;
      if (isBeforeDay(expenseDate, startForProjection)) return;
      const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        monthlyData[monthKey].decaissements += amount;
        monthlyData[monthKey].decaissementsDepenses += amount;
      }
    });

    // Ajouter les taxes des paiements réels (mois +1, au 30)
    // Inclure tous les paiements (y compris ceux du mois précédent) pour calculer les taxes
    (payments || []).forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      // Les taxes sont imputées au 30 du mois suivant le paiement
      const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
      const monthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`;
      // IMPORTANT: même si le paiement est avant l'ancre, la taxe peut tomber après l'ancre (cash out futur)
      // Inclure les taxes même si elles sont en dehors de la période initiale
      // (car elles impactent la période affichée)
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].taxes += payment.taxAmount;
      }
    });

    // Tooltip: si l'ancre (solde manuel) est au milieu d'un mois, afficher les mouvements avant ancre pour ce mois
    if (projectionAnchorDate && !isNaN(projectionAnchorDate.getTime())) {
      const anchorDay = new Date(projectionAnchorDate);
      anchorDay.setHours(0, 0, 0, 0);
      const anchorMonthKey = `${anchorDay.getFullYear()}-${String(anchorDay.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[anchorMonthKey]) {
        const monthStart = new Date(anchorDay.getFullYear(), anchorDay.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);

        let encAvant = 0;
        let encAvantVentes = 0;
        let encAvantDebours = 0;
        let decAvant = 0;
        let taxesAvant = 0;

        // Encaissements réels avant ancre (même mois)
        (payments || []).forEach((p: any) => {
          const d = new Date(p.paymentDate);
          if (isNaN(d.getTime())) return;
          // Dans le mois et avant le jour d'ancre
          if (d < monthStart) return;
          if (toDateKey(d) >= toDateKey(anchorDay)) return;
          const amt = Number(p.amount || 0);
          encAvant += amt;
          if (p.deboursNoteId) encAvantDebours += amt;
          else encAvantVentes += amt;
        });

        // Décaissements avant ancre (dépenses, même mois)
        (expenses || []).forEach((e: any) => {
          if (!e.invoiceDate) return;
          const d = new Date(e.invoiceDate);
          if (isNaN(d.getTime())) return;
          if (d < monthStart) return;
          if (toDateKey(d) >= toDateKey(anchorDay)) return;
          decAvant += Number(e.amountTTC || e.amountHT || 0);
        });

        // Taxes avant ancre : cash-out "taxDate" (mois+1 au 30). Rare, mais on l'affiche si ça tombe avant l'ancre.
        (payments || []).forEach((p: any) => {
          const pd = new Date(p.paymentDate);
          if (isNaN(pd.getTime())) return;
          const taxDate = new Date(pd.getFullYear(), pd.getMonth() + 1, 30);
          taxDate.setHours(0, 0, 0, 0);
          if (taxDate < monthStart) return;
          if (toDateKey(taxDate) >= toDateKey(anchorDay)) return;
          taxesAvant += Number(p.taxAmount || 0);
        });

        monthlyData[anchorMonthKey].anchorInfo = {
          label: anchorDay.toLocaleDateString('fr-FR'),
          encaissements: encAvant,
          encaissementsVentes: encAvantVentes,
          encaissementsDebours: encAvantDebours,
          decaissements: decAvant,
          taxes: taxesAvant
        };
      }
    }

    // Calculer les soldes finaux
    // Le solde initial du premier mois est le solde au début de période (periodInitialBalance)
    const sortedMonths = Object.values(monthlyData).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    
    return sortedMonths.map((month, index, array) => {
      const totalEncaissements = month.encaissementsPrevisionnels + month.encaissementsReels;
      // Les taxes sont des décaissements, donc on les soustrait
      const totalDecaissements = month.decaissements + month.taxes;
      
      if (index === 0) {
        // Premier mois : solde initial = solde au début de période
        month.soldeInitial = periodInitialBalance;
        month.solde = periodInitialBalance + totalEncaissements - totalDecaissements;
      } else {
        // Mois suivants : solde initial = solde final du mois précédent
        month.soldeInitial = array[index - 1].solde;
        month.solde = array[index - 1].solde + totalEncaissements - totalDecaissements;
      }
      
      // Pour l'affichage dans le graphique, on garde taxes séparé mais on peut aussi créer un total décaissements
      month.totalDecaissements = totalDecaissements;
      return month;
    });
  }, [forecast, payments, expenses, periodInitialBalance, startDate, endDate, viewGranularity, buildDailyData, projectionAnchorDate, selectedStages]);


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

  const projectionCardIsDuplicateOfBalance =
    balanceIsManual &&
    projectionAnchorDate &&
    balanceTodayDate &&
    toDateKey(new Date(balanceTodayDate)) === toDateKey(projectionAnchorDate) &&
    Math.abs(balanceToday - periodInitialBalance) < 0.005; // tolérance float

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

      {/* Soldes */}
      <div className={`grid grid-cols-1 ${projectionCardIsDuplicateOfBalance ? '' : 'md:grid-cols-2'} gap-4`}>
        {/* Solde à jour J */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-slate-500">Solde à jour J</h2>
                {balanceIsManual ? (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                    Manuel
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                    Calculé
                  </span>
                )}
                {projectionCardIsDuplicateOfBalance && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded">
                    Ancre de projection
                  </span>
                )}
              </div>
              <p className={`text-3xl font-bold mt-1 ${balanceToday < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(balanceToday)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Solde de référence (manuel ou recalculé depuis le dernier manuel).
              </p>
            </div>
            <CurrencyEuroIcon className="h-12 w-12 text-slate-300" />
          </div>
        </div>

        {/* Solde au début de période */}
        {!projectionCardIsDuplicateOfBalance && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-slate-500">
                Solde au début de la projection
                {projectionAnchorDate ? ` (${projectionAnchorDate.toLocaleDateString('fr-FR')})` : ''}
              </h2>
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                  Projection
                </span>
              </div>
              <p className={`text-3xl font-bold mt-1 ${periodInitialBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(periodInitialBalance)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
              Point de départ utilisé pour le graphique et le tableau (dernier solde manuel si disponible).
              </p>
            </div>
            <ChartBarIcon className="h-12 w-12 text-slate-300" />
          </div>
        </div>
        )}
      </div>

      {/* Filtres période */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
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
                  // Ne pas recharger pendant la saisie - le useEffect s'en chargera quand les dates seront complètes
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
                  // Ne pas recharger pendant la saisie - le useEffect s'en chargera quand les dates seront complètes
                }}
                className="px-3 py-1 border border-slate-300 rounded text-sm"
              />
            </>
          )}

          {/* Filtre étapes du tunnel (prévisionnel opportunités) */}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Étapes :</span>
            {[
              { id: 'CLOSED_WON', label: 'Gagné' },
              { id: 'FINALIZED', label: 'Finalisé' },
              { id: 'PROPOSAL', label: 'Proposition' }
            ].map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selectedStages.has(s.id)}
                  onChange={(e) => {
                    setSelectedStages((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    });
                  }}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Graphique */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Évolution de la trésorerie</h2>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-slate-700">Vue :</label>
            <button
              onClick={() => setViewGranularity('month')}
              className={`px-3 py-1 rounded text-sm ${viewGranularity === 'month' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Mensuelle
            </button>
            <button
              onClick={() => {
                setViewGranularity('day');
              }}
              className={`px-3 py-1 rounded text-sm ${viewGranularity === 'day' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              title="Vue journalière (limite: 90 jours pour les performances)"
            >
              Journalière
            </button>
            {showDayViewWarning && (
              <span className="text-xs text-orange-600">Période longue - chargement plus lent</span>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            {(() => {
              const isDay = viewGranularity === 'day';
              const shouldRotateMonths = !isDay && Array.isArray(chartData) && chartData.length > 9;
              return (
                <XAxis
                  dataKey={isDay ? 'day' : 'month'}
                  angle={isDay ? -45 : shouldRotateMonths ? -30 : 0}
                  textAnchor={isDay ? 'end' : shouldRotateMonths ? 'end' : 'middle'}
                  height={isDay ? 80 : shouldRotateMonths ? 55 : 30}
                  interval={isDay ? 'preserveStartEnd' : 0}
                  tickMargin={shouldRotateMonths ? 10 : 4}
                />
              );
            })()}
            <YAxis />
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 50 }} />
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
          currentBalance={periodInitialBalance}
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
        currentBalance={balanceToday}
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

