import { TreasuryForecast } from '../../services/treasuryService';
import { Payment } from '../../services/paymentService';

export interface TreasuryExpense {
  amountTTC: number | null;
  amountHT: number | null;
  invoiceDate: string | null;
  opportunityId?: string;
}

export type SelectedStages = Set<string>;

export interface DailyCalculationInput {
  startDate: Date;
  endDate: Date;
  periodInitialBalance: number;
  projectionAnchorDate: Date | null;
  forecast: TreasuryForecast | null;
  payments: Payment[];
  expenses: TreasuryExpense[];
  selectedStages: SelectedStages;
}

export interface MonthlyCalculationInput {
  startDate: Date;
  endDate: Date;
  periodInitialBalance: number;
  projectionAnchorDate: Date | null;
  // Solde manuel au jour d'ancre (si disponible)
  anchorBalance?: number | null;
  forecast: TreasuryForecast | null;
  payments: Payment[];
  expenses: TreasuryExpense[];
  selectedStages: SelectedStages;
}

export const toDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isBeforeDay = (a: Date, b: Date) => {
  return toDateKey(a) < toDateKey(b);
};

export function buildDailyTreasuryData(input: DailyCalculationInput) {
  const {
    startDate,
    endDate,
    periodInitialBalance,
    projectionAnchorDate,
    anchorBalance,
    forecast,
    payments,
    expenses,
    selectedStages
  } = input;

  if (!forecast) return [];

  const dailyData: Record<string, any> = {};

  // Pour la période affichée, on part toujours de startDate (ex: M-1),
  // même si l'ancre de projection est plus tardive. L'ancre sert uniquement
  // au solde initial, pas à tronquer la période.
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(
      current.getDate()
    ).padStart(2, '0')}`;
    dailyData[dayKey] = {
      day: current.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      dayKey,
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

  const totalPaidByOpportunity = new Map<string, number>();
  (payments || []).forEach((payment) => {
    if (payment.opportunityId) {
      const prev = totalPaidByOpportunity.get(payment.opportunityId) || 0;
      totalPaidByOpportunity.set(payment.opportunityId, prev + Number(payment.amount));
    }
  });

  const finalizedExpenseIds = new Set(
    (forecast?.finalizedExpenses || [])
      .filter((e: any) => e.opportunityId && e.invoiceDate)
      .map((e: any) => `${e.opportunityId!}-${e.invoiceDate!}`)
  );

  (forecast?.finalizedExpenses || []).forEach((expense: any) => {
    if (!expense.invoiceDate) return;
    const expenseDate = new Date(expense.invoiceDate);
    if (isNaN(expenseDate.getTime())) return;
    if (isBeforeDay(expenseDate, startDate)) return;
    const dayKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(
      expenseDate.getDate()
    ).padStart(2, '0')}`;
    if (dailyData[dayKey]) {
      const amount = expense.amountTTC || expense.amountHT || 0;
      dailyData[dayKey].decaissements += amount;
      dailyData[dayKey].decaissementsDepenses += amount;
    }
  });

  (forecast?.opportunities || []).forEach((opp) => {
    if (!opp.expectedPaymentDate || !opp.amount) return;
    if (opp.stage && !selectedStages.has(opp.stage)) return;
    if (opp.stage === 'FINALIZED') return;

    try {
      const paymentDate = new Date(opp.expectedPaymentDate);
      paymentDate.setHours(0, 0, 0, 0);
      const dayKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(
        paymentDate.getDate()
      ).padStart(2, '0')}`;
      if (dailyData[dayKey]) {
        const montantTotal = Number(opp.amount) || 0;
        const advancePayments = forecast?.advancePaymentsByOpportunity?.[opp.id] || 0;
        const paidAmount = totalPaidByOpportunity.get(opp.id) || 0;
        const montantRestant = montantTotal - advancePayments - paidAmount;
        if (montantRestant <= 0) {
          return;
        }
        dailyData[dayKey].encaissementsPrevisionnels += montantRestant;
        dailyData[dayKey].encaissementsPrevisionnelOpportunites += montantRestant;

        const taxRate = opp.taxRate ?? 0.28;
        const taxAmount = montantRestant * taxRate;
        const taxDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 30);
        taxDate.setHours(0, 0, 0, 0);
        const taxDayKey = `${taxDate.getFullYear()}-${String(taxDate.getMonth() + 1).padStart(2, '0')}-${String(
          taxDate.getDate()
        ).padStart(2, '0')}`;
        if (dailyData[taxDayKey]) {
          dailyData[taxDayKey].taxes += taxAmount;
        }
      }
    } catch (error) {
      console.error('Erreur traitement opportunité prévisionnelle jour:', (opp as any).id, error);
    }
  });

  (forecast?.deboursNotesForecast || []).forEach((debours) => {
    if (!debours.expectedPaymentDate || !debours.totalFrais) return;
    if (payments.find((p) => p.deboursNoteId === debours.id)) return;

    try {
      const paymentDate = new Date(debours.expectedPaymentDate);
      paymentDate.setHours(0, 0, 0, 0);
      const dayKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(
        paymentDate.getDate()
      ).padStart(2, '0')}`;
      if (dailyData[dayKey]) {
        const montant = Number(debours.totalFrais) || 0;
        dailyData[dayKey].encaissementsPrevisionnels += montant;
        dailyData[dayKey].encaissementsPrevisionnelDebours += montant;
      }
    } catch (error) {
      console.error('Erreur traitement note de débours jour:', (debours as any).id, error);
    }
  });

  (payments || []).forEach((payment) => {
    const paymentDate = new Date(payment.paymentDate);
    if (isNaN(paymentDate.getTime())) return;
    if (isBeforeDay(paymentDate, startDate)) return;
    const dayKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(
      paymentDate.getDate()
    ).padStart(2, '0')}`;
    if (dailyData[dayKey]) {
      dailyData[dayKey].encaissementsReels += payment.amount;
    }
  });

  (expenses || []).forEach((expense) => {
    if (!expense.invoiceDate) return;
    if (expense.opportunityId && finalizedExpenseIds.has(`${expense.opportunityId}-${expense.invoiceDate}`)) {
      return;
    }
    const expenseDate = new Date(expense.invoiceDate);
    if (isNaN(expenseDate.getTime())) return;
    if (isBeforeDay(expenseDate, startDate)) return;
    const dayKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(
      expenseDate.getDate()
    ).padStart(2, '0')}`;
    if (dailyData[dayKey]) {
      const amount = expense.amountTTC || expense.amountHT || 0;
      dailyData[dayKey].decaissements += amount;
      dailyData[dayKey].decaissementsDepenses += amount;
    }
  });

  (payments || []).forEach((payment) => {
    const paymentDate = new Date(payment.paymentDate);
    const taxDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 30);
    if (isNaN(taxDate.getTime())) return;
    if (isBeforeDay(taxDate, startDate)) return;
    const dayKey = `${taxDate.getFullYear()}-${String(taxDate.getMonth() + 1).padStart(2, '0')}-${String(
      taxDate.getDate()
    ).padStart(2, '0')}`;
    if (dailyData[dayKey]) {
      dailyData[dayKey].taxes += Number(payment.taxAmount ?? 0);
    }
  });

  const sortedDays = Object.values(dailyData).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  return sortedDays.map((day: any, index: number, array: any[]) => {
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
}

export function buildMonthlyTreasuryData(input: MonthlyCalculationInput) {
  const {
    startDate,
    endDate,
    periodInitialBalance,
    projectionAnchorDate,
    forecast,
    payments,
    expenses,
    selectedStages
  } = input;

  const anchorBalance = typeof input.anchorBalance === 'number' ? input.anchorBalance : null;

  if (!forecast) {
    return [];
  }

  const monthlyData: Record<string, any> = {};

  // Comme pour la vue journalière, la période affichée commence toujours à startDate (ex: M-1).
  // L'ancre de projection n'influence que le solde initial et les infos de tooltip.
  const current = new Date(startDate);
  current.setDate(1);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = {
      month: current.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      monthKey,
      solde: 0,
      encaissementsPrevisionnels: 0,
      encaissementsPrevisionnelOpportunites: 0,
      encaissementsPrevisionnelDebours: 0,
      encaissementsReels: 0,
      decaissements: 0,
      decaissementsDepenses: 0,
      taxes: 0,
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

  const totalPaidByOpportunity = new Map<string, number>();
  (payments || []).forEach((payment) => {
    if (payment.opportunityId) {
      const prev = totalPaidByOpportunity.get(payment.opportunityId) || 0;
      totalPaidByOpportunity.set(payment.opportunityId, prev + Number(payment.amount));
    }
  });

  (forecast?.finalizedExpenses || []).forEach((expense) => {
    if (!expense.invoiceDate || !expense.opportunityId) return;
    const expenseDate = new Date(expense.invoiceDate);
    const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[monthKey]) {
      const amount = expense.amountTTC || expense.amountHT || 0;
      monthlyData[monthKey].decaissements += amount;
      monthlyData[monthKey].decaissementsDepenses += amount;
    }
  });

  (forecast?.deboursNotesForecast || []).forEach((debours) => {
    if (!debours.expectedPaymentDate || !debours.totalFrais) return;

    const realPayment = payments.find((p) => p.deboursNoteId === debours.id);
    if (realPayment) {
      return;
    }

    try {
      const paymentDate = new Date(debours.expectedPaymentDate);
      if (isNaN(paymentDate.getTime())) {
        console.warn('Date invalide pour note de débours:', (debours as any).id, debours.expectedPaymentDate);
        return;
      }
      if (paymentDate < startDate) return;

      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        const montantDebours = Number(debours.totalFrais) || 0;
        monthlyData[monthKey].encaissementsPrevisionnels += montantDebours;
        monthlyData[monthKey].encaissementsPrevisionnelDebours += montantDebours;
      }
    } catch (error) {
      console.error('Erreur traitement note de débours prévisionnelle:', (debours as any).id, error);
    }
  });

  (forecast?.opportunities || []).forEach((opp) => {
    if (!opp.expectedPaymentDate || !opp.amount) return;
    if (opp.stage && !selectedStages.has(opp.stage)) return;
    if (opp.stage === 'FINALIZED') {
      return;
    }

    try {
      const paymentDate = new Date(opp.expectedPaymentDate);
      if (isNaN(paymentDate.getTime())) {
        console.warn('Date invalide pour opportunité:', (opp as any).id, opp.expectedPaymentDate);
        return;
      }
      if (paymentDate < startDate) return;

      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        const montantTotal = Number(opp.amount) || 0;
        const advancePayments = forecast?.advancePaymentsByOpportunity?.[opp.id] || 0;
        const paidAmount = totalPaidByOpportunity.get(opp.id) || 0;
        const montantRestant = montantTotal - advancePayments - paidAmount;

        if (montantRestant > 0) {
          monthlyData[monthKey].encaissementsPrevisionnels += montantRestant;
          monthlyData[monthKey].encaissementsPrevisionnelOpportunites += montantRestant;

          const taxRate = opp.taxRate ?? 0.28;
          const taxAmount = montantRestant * taxRate;
          const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
          const taxMonthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyData[taxMonthKey]) {
            monthlyData[taxMonthKey].taxes += taxAmount;
          }
        }
      }
    } catch (error) {
      console.error('Erreur traitement opportunité prévisionnelle:', (opp as any).id, error);
    }
  });

  (payments || []).forEach((payment) => {
    const paymentDate = new Date(payment.paymentDate);
    if (isNaN(paymentDate.getTime())) return;
    if (isBeforeDay(paymentDate, startDate)) return;
    const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].encaissementsReels += payment.amount;
    }
  });

  const finalizedExpenseIds = new Set(
    (forecast?.finalizedExpenses || [])
      .filter((e) => e.opportunityId && e.invoiceDate)
      .map((e) => `${e.opportunityId!}-${e.invoiceDate!}`)
  );

  (expenses || []).forEach((expense) => {
    if (!expense.invoiceDate) return;

    if (expense.opportunityId && finalizedExpenseIds.has(`${expense.opportunityId}-${expense.invoiceDate}`)) {
      return;
    }

    const expenseDate = new Date(expense.invoiceDate);
    if (isNaN(expenseDate.getTime())) return;
    if (isBeforeDay(expenseDate, startDate)) return;
    const monthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[monthKey]) {
      const amount = expense.amountTTC || expense.amountHT || 0;
      monthlyData[monthKey].decaissements += amount;
      monthlyData[monthKey].decaissementsDepenses += amount;
    }
  });

  (payments || []).forEach((payment) => {
    const paymentDate = new Date(payment.paymentDate);
    const taxMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 1);
    const monthKey = `${taxMonth.getFullYear()}-${String(taxMonth.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].taxes += Number(payment.taxAmount ?? 0);
    }
  });

  let anchorMonthKey: string | null = null;

  if (projectionAnchorDate && !isNaN(projectionAnchorDate.getTime())) {
    const anchorDay = new Date(projectionAnchorDate);
    anchorDay.setHours(0, 0, 0, 0);
    anchorMonthKey = `${anchorDay.getFullYear()}-${String(anchorDay.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[anchorMonthKey]) {
      const monthStart = new Date(anchorDay.getFullYear(), anchorDay.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);

      let encAvant = 0;
      let encAvantVentes = 0;
      let encAvantDebours = 0;
      let decAvant = 0;
      let taxesAvant = 0;

      (payments || []).forEach((p: any) => {
        const d = new Date(p.paymentDate);
        if (isNaN(d.getTime())) return;
        if (d < monthStart) return;
        if (toDateKey(d) >= toDateKey(anchorDay)) return;
        const amt = Number(p.amount || 0);
        encAvant += amt;
        if (p.deboursNoteId) encAvantDebours += amt;
        else encAvantVentes += amt;
      });

      (expenses || []).forEach((e: any) => {
        if (!e.invoiceDate) return;
        const d = new Date(e.invoiceDate);
        if (isNaN(d.getTime())) return;
        if (d < monthStart) return;
        if (toDateKey(d) >= toDateKey(anchorDay)) return;
        decAvant += Number(e.amountTTC || e.amountHT || 0);
      });

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

  const sortedMonths = Object.values(monthlyData).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return sortedMonths.map((month: any, index: number, array: any[]) => {
    const totalEncaissements = month.encaissementsPrevisionnels + month.encaissementsReels;
    const totalDecaissements = month.decaissements + month.taxes;

    // Si on a une ancre dans ce mois et un solde manuel, on rebase le solde
    if (anchorMonthKey && month.monthKey === anchorMonthKey && anchorBalance != null && month.anchorInfo) {
      const anchorEncaissements = month.anchorInfo.encaissements;
      const anchorDecaissements = month.anchorInfo.decaissements + month.anchorInfo.taxes;

      const encaissementsApresAncre = totalEncaissements - anchorEncaissements;
      const decaissementsApresAncre = totalDecaissements - anchorDecaissements;

      month.soldeInitial = anchorBalance;
      month.solde = anchorBalance + encaissementsApresAncre - decaissementsApresAncre;
    } else if (index === 0) {
      month.soldeInitial = periodInitialBalance;
      month.solde = periodInitialBalance + totalEncaissements - totalDecaissements;
    } else {
      month.soldeInitial = array[index - 1].solde;
      month.solde = array[index - 1].solde + totalEncaissements - totalDecaissements;
    }

    month.totalDecaissements = totalDecaissements;
    month.soldeFinal = month.solde;
    return month;
  });
}

