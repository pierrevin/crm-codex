import { useMemo, useState } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart
} from 'recharts';

import { DateRangeFilter } from './DateRangeFilter';
import {
  formatPeriodLabel,
  getCalendarYearRange,
  getMonthKeysInRange,
  isInDateRange
} from '../utils/dateRange';

type Opportunity = {
  id: string;
  title: string;
  stage: 'QUALIFICATION' | 'PROPOSAL' | 'CLOSED_WON' | 'FINALIZED' | 'CLOSED_LOST';
  amount?: number;
  closeDate?: string;
  expectedPaymentDate?: string;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

export function ProjectionView({ opportunities }: { opportunities: Opportunity[] }) {
  const defaultRange = getCalendarYearRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const { projectionData, totals, periodLabel } = useMemo(() => {
    const relevantOpps = opportunities.filter(
      opp => opp.closeDate && isInDateRange(opp.closeDate, dateFrom, dateTo)
    );

    const monthlyData: Record<
      string,
      {
        caPrev: number;
        caNet: number;
        wonCount: number;
        pipelineCount: number;
      }
    > = {};

    for (const monthKey of getMonthKeysInRange(dateFrom, dateTo)) {
      monthlyData[monthKey] = { caPrev: 0, caNet: 0, wonCount: 0, pipelineCount: 0 };
    }

    relevantOpps.forEach(opp => {
      if (!opp.closeDate) return;

      const date = new Date(opp.closeDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) return;

      const amount = Number(opp.amount) || 0;

      if (opp.stage === 'CLOSED_WON' || opp.stage === 'FINALIZED') {
        monthlyData[monthKey].wonCount++;
      } else if (opp.stage !== 'CLOSED_LOST') {
        monthlyData[monthKey].pipelineCount++;
      } else {
        return;
      }

      monthlyData[monthKey].caPrev += amount;
      monthlyData[monthKey].caNet += amount * 0.73;
    });

    const data = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, monthTotals]) => {
        const monthOpps = relevantOpps.filter(opp => {
          if (!opp.closeDate) return false;
          const date = new Date(opp.closeDate);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          return key === month;
        });

        return {
          month: new Date(month + '-01').toLocaleDateString('fr-FR', {
            month: 'short',
            year: 'numeric'
          }),
          monthKey: month,
          caPrev: Math.round(monthTotals.caPrev),
          caNet: Math.round(monthTotals.caNet),
          wonCount: monthTotals.wonCount,
          pipelineCount: monthTotals.pipelineCount,
          totalCount: monthTotals.wonCount + monthTotals.pipelineCount,
          opportunities: monthOpps
        };
      });

    const agg = data.reduce(
      (acc, month) => ({
        caPrev: acc.caPrev + month.caPrev,
        caNet: acc.caNet + month.caNet,
        wonCount: acc.wonCount + month.wonCount,
        pipelineCount: acc.pipelineCount + month.pipelineCount,
        totalCount: acc.totalCount + month.totalCount
      }),
      { caPrev: 0, caNet: 0, wonCount: 0, pipelineCount: 0, totalCount: 0 }
    );

    return {
      projectionData: data,
      totals: agg,
      periodLabel: formatPeriodLabel(dateFrom, dateTo)
    };
  }, [opportunities, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">📊 Projection CA</h2>
          <p className="text-sm text-slate-500 mt-1">{periodLabel}</p>
        </div>

        <div className="flex flex-col gap-4 lg:items-end">
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
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
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {projectionData.some(m => m.caPrev > 0) ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={projectionData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5
                }}
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
                    if (!active || !payload || !payload.length) return null;

                    const data = payload[0]?.payload;
                    if (!data) return null;

                    return (
                      <div className="bg-slate-800 text-white p-3 rounded-lg shadow-lg border border-slate-700 max-w-xs">
                        <p className="font-semibold text-sm mb-2">{label}</p>
                        <div className="space-y-1 text-xs">
                          <p>
                            <span className="text-indigo-300">CA Prévu :</span>{' '}
                            {data.caPrev.toLocaleString()} €
                          </p>
                          <p>
                            <span className="text-emerald-300">CA Net (-27%) :</span>{' '}
                            {data.caNet.toLocaleString()} €
                          </p>
                          {data.opportunities && data.opportunities.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-600">
                              <p className="text-slate-300 mb-1">Clients :</p>
                              {data.opportunities.slice(0, 3).map((opp: Opportunity, idx: number) => (
                                <p key={idx} className="text-xs text-slate-200">
                                  • {opp.title} ({opp.amount?.toLocaleString()} €)
                                  {opp.contact &&
                                    ` - ${opp.contact.firstName} ${opp.contact.lastName || ''}`}
                                  {opp.company && ` (${opp.company.name})`}
                                </p>
                              ))}
                              {data.opportunities.length > 3 && (
                                <p className="text-xs text-slate-400">
                                  + {data.opportunities.length - 3} autres...
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={value => (value === 'caPrev' ? 'CA Prévu' : 'CA Net (-27%)')}
                />
                <Bar dataKey="caPrev" fill="#6366f1" name="caPrev" radius={[4, 4, 0, 0]} />
                <Bar dataKey="caNet" fill="#10b981" name="caNet" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="caNet"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="caNet"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <p>Aucune donnée de projection sur cette période</p>
            <p className="text-sm mt-2">
              Ajustez les dates ou ajoutez des opportunités avec une date de clôture
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
