import { parseDateOnly } from './dateRange';

export type RawDashboardData = {
  totalContacts: number;
  companiesCount: number;
  opportunities: any[];
  payments: any[];
};

export function matchesStage(opp: { stage: string }, stages: Set<string>): boolean {
  if (stages.size === 0) return false;
  return stages.has(opp.stage);
}

export function matchesGlobalPeriod(
  opp: { closeDate?: string; createdAt?: string },
  dateFrom?: string,
  dateTo?: string
): boolean {
  const rawDate = opp.closeDate || opp.createdAt;
  if (!rawDate) return true;

  const d = new Date(rawDate);
  if (dateFrom) {
    const from = parseDateOnly(dateFrom);
    if (d < from) return false;
  }
  if (dateTo) {
    const to = parseDateOnly(dateTo);
    to.setHours(23, 59, 59, 999);
    if (d > to) return false;
  }
  return true;
}

export function computeDashboardStats(
  raw: RawDashboardData,
  filterStages: Set<string>,
  filterDateFrom?: string,
  filterDateTo?: string
) {
  const { opportunities, payments, totalContacts, companiesCount } = raw;

  const stageFilteredOpps = opportunities.filter(opp => matchesStage(opp, filterStages));

  const filteredOpps = stageFilteredOpps.filter(opp =>
    matchesGlobalPeriod(opp, filterDateFrom, filterDateTo)
  );

  const opportunitiesByStage: Record<string, number> = {};
  let pipelineValue = 0;
  let wonValue = 0;
  let sumNetRevenue = 0;
  let weightedTaxNumerator = 0;
  let weightedTaxDenominator = 0;

  for (const opp of filteredOpps) {
    const stage = opp.stage;
    const amount = Number(opp.amount) || 0;
    const taxRate =
      opp.taxRate !== undefined && opp.taxRate !== null ? Number(opp.taxRate) : 0.27;

    opportunitiesByStage[stage] = (opportunitiesByStage[stage] || 0) + 1;

    if (stage !== 'CLOSED_LOST') {
      pipelineValue += amount;
    }

    if (stage === 'CLOSED_WON' || stage === 'FINALIZED') {
      wonValue += amount;
      sumNetRevenue += amount * (1 - taxRate);
      weightedTaxNumerator += amount * taxRate;
      weightedTaxDenominator += amount;
    }
  }

  const averageTaxRate =
    weightedTaxDenominator > 0 ? weightedTaxNumerator / weightedTaxDenominator : 0.27;

  const netRevenue = sumNetRevenue > 0 ? sumNetRevenue : wonValue * (1 - averageTaxRate);

  const recentOpportunities = [...filteredOpps]
    .sort((a, b) => {
      const da = new Date(a.closeDate || a.createdAt || 0).getTime();
      const db = new Date(b.closeDate || b.createdAt || 0).getTime();
      return db - da;
    })
    .slice(0, 5);

  const filteredPayments = payments.filter((p: any) => {
    const rawDate = p.paymentDate;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (filterDateFrom) {
      const from = parseDateOnly(filterDateFrom);
      if (d < from) return false;
    }
    if (filterDateTo) {
      const to = parseDateOnly(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  });

  let paidGross = 0;
  let paidNet = 0;

  for (const p of filteredPayments) {
    const amount = Number(p.amount) || 0;
    const taxAmount =
      p.taxAmount !== undefined && p.taxAmount !== null
        ? Number(p.taxAmount)
        : amount * Number(p.taxRate ?? 0.27);
    paidGross += amount;
    paidNet += amount - taxAmount;
  }

  return {
    totalContacts,
    totalCompanies: companiesCount,
    totalOpportunities: filteredOpps.length,
    pipelineValue,
    wonValue,
    netRevenue,
    averageTaxRate,
    opportunitiesByStage,
    recentOpportunities,
    filteredOpportunities: filteredOpps,
    stageFilteredOpportunities: stageFilteredOpps,
    revenueStats: {
      averageTaxRate,
      signed: { gross: wonValue, net: netRevenue },
      invoiced: { gross: 0, net: 0 },
      paid: { gross: paidGross, net: paidNet }
    }
  };
}
