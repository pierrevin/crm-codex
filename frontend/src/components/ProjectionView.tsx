import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

import {
  OPPORTUNITY_STAGES,
  STAGE_DISPLAY_ORDER,
  type OpportunityStageId
} from '../constants/opportunityStages';
import { getMonthKeysInRange } from '../utils/dateRange';

type Opportunity = {
  id: string;
  title: string;
  stage: OpportunityStageId;
  amount?: number;
  closeDate?: string;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

type MonthRow = {
  month: string;
  monthKey: string;
  total: number;
  opportunities: Opportunity[];
} & Partial<Record<OpportunityStageId, number>>;

export function ProjectionView({
  opportunities,
  dateFrom,
  dateTo,
  periodLabel,
  visibleStages
}: {
  opportunities: Opportunity[];
  dateFrom?: string;
  dateTo?: string;
  periodLabel?: string;
  visibleStages: Set<string>;
}) {
  const activeStages = STAGE_DISPLAY_ORDER.filter(stage => visibleStages.has(stage));

  const { projectionData, totals } = useMemo(() => {
    const relevantOpps = opportunities.filter(opp => opp.closeDate);

    const monthKeysFromData = [
      ...new Set(
        relevantOpps.map(opp => {
          const date = new Date(opp.closeDate!);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        })
      )
    ].sort();

    const monthKeys =
      dateFrom && dateTo ? getMonthKeysInRange(dateFrom, dateTo) : monthKeysFromData;

    const monthlyData: Record<string, MonthRow> = {};

    for (const monthKey of monthKeys) {
      const row: MonthRow = {
        month: new Date(monthKey + '-01').toLocaleDateString('fr-FR', {
          month: 'short',
          year: 'numeric'
        }),
        monthKey,
        total: 0,
        opportunities: []
      };
      for (const stage of activeStages) {
        row[stage] = 0;
      }
      monthlyData[monthKey] = row;
    }

    relevantOpps.forEach(opp => {
      if (!opp.closeDate || !activeStages.includes(opp.stage)) return;

      const date = new Date(opp.closeDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const row = monthlyData[monthKey];
      if (!row) return;

      const amount = Number(opp.amount) || 0;
      row[opp.stage] = (row[opp.stage] ?? 0) + amount;
      row.total += amount;
      row.opportunities.push(opp);
    });

    const data = Object.values(monthlyData).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    let caPrev = 0;
    let wonCount = 0;
    let totalCount = 0;

    for (const opp of relevantOpps) {
      if (!activeStages.includes(opp.stage)) continue;
      const amount = Number(opp.amount) || 0;
      caPrev += amount;
      totalCount++;
      if (opp.stage === 'CLOSED_WON' || opp.stage === 'FINALIZED') {
        wonCount++;
      }
    }

    return {
      projectionData: data,
      totals: {
        caPrev,
        caNet: Math.round(caPrev * 0.73),
        wonCount,
        totalCount
      }
    };
  }, [opportunities, dateFrom, dateTo, activeStages.join(',')]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">📊 Projection CA</h2>
          {periodLabel && <p className="text-sm text-slate-500 mt-1">{periodLabel}</p>}
        </div>

        <div className="flex gap-6 text-sm">
          <div className="text-right">
            <p className="text-slate-500">CA Prévu Total</p>
            <p className="text-xl font-bold text-indigo-600">
              {totals.caPrev.toLocaleString()} €
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">CA Net Total (-27%)</p>
            <p className="text-xl font-bold text-emerald-600">
              {totals.caNet.toLocaleString()} €
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {projectionData.some(m => m.total > 0) ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={projectionData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={value => `${(value / 1000).toFixed(0)}k €`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as MonthRow;
                    if (!row) return null;

                    return (
                      <div className="bg-slate-800 text-white p-3 rounded-lg shadow-lg border border-slate-700 max-w-xs">
                        <p className="font-semibold text-sm mb-2">{label}</p>
                        <div className="space-y-1 text-xs">
                          {activeStages.map(stage => {
                            const value = row[stage] ?? 0;
                            if (value <= 0) return null;
                            return (
                              <p key={stage}>
                                <span style={{ color: OPPORTUNITY_STAGES[stage].chartColor }}>
                                  {OPPORTUNITY_STAGES[stage].label} :
                                </span>{' '}
                                {value.toLocaleString()} €
                              </p>
                            );
                          })}
                          <p className="pt-1 border-t border-slate-600 font-medium">
                            Total : {row.total.toLocaleString()} €
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend />
                {activeStages.map(stage => (
                  <Bar
                    key={stage}
                    dataKey={stage}
                    name={OPPORTUNITY_STAGES[stage].label}
                    stackId="ca"
                    fill={OPPORTUNITY_STAGES[stage].chartColor}
                    radius={stage === activeStages[activeStages.length - 1] ? [4, 4, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <p>Aucune donnée de projection sur cette période</p>
            <p className="text-sm mt-2">
              Modifiez les filtres en haut de page ou ajoutez des opportunités avec une date de
              clôture
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-slate-500">CA Moyen par Opportunité</p>
            <p className="text-2xl font-bold text-indigo-600">
              {totals.totalCount > 0
                ? Math.round(totals.caPrev / totals.totalCount).toLocaleString()
                : 0}{' '}
              €
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-slate-500">Taux de Conversion</p>
            <p className="text-2xl font-bold text-emerald-600">
              {totals.totalCount > 0
                ? Math.round((totals.wonCount / totals.totalCount) * 100)
                : 0}
              %
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-slate-500">Marge Nette Moyenne</p>
            <p className="text-2xl font-bold text-slate-600">73%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
