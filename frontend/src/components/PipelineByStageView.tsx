import { useMemo, useState } from 'react';

import { DateRangeFilter } from './DateRangeFilter';
import {
  formatPeriodLabel,
  getCalendarYearRange,
  isInDateRange
} from '../utils/dateRange';

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-500' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-500' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-500' },
  FINALIZED: { label: 'Finalisé / réglé', color: 'bg-amber-500' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-500' }
} as const;

type Opportunity = {
  id: string;
  stage: string;
  amount?: number;
  closeDate?: string;
  createdAt?: string;
};

export function PipelineByStageView({ opportunities }: { opportunities: Opportunity[] }) {
  const defaultRange = getCalendarYearRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const { filteredOpps, pipelineValue, byStage } = useMemo(() => {
    const filtered = opportunities.filter(opp => {
      const rawDate = opp.closeDate || opp.createdAt;
      return isInDateRange(rawDate, dateFrom, dateTo);
    });

    const byStageMap: Record<string, { count: number; value: number }> = {};
    let total = 0;

    for (const opp of filtered) {
      const stage = opp.stage;
      const amount = Number(opp.amount) || 0;
      if (!byStageMap[stage]) {
        byStageMap[stage] = { count: 0, value: 0 };
      }
      byStageMap[stage].count += 1;
      if (stage !== 'CLOSED_LOST') {
        byStageMap[stage].value += amount;
        total += amount;
      }
    }

    return {
      filteredOpps: filtered,
      pipelineValue: total,
      byStage: byStageMap
    };
  }, [opportunities, dateFrom, dateTo]);

  const periodLabel = formatPeriodLabel(dateFrom, dateTo);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            💰 Valeur du pipeline par étape
          </h2>
          <p className="text-sm text-slate-500 mt-1">{periodLabel}</p>
        </div>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />
      </div>

      <div className="space-y-4">
        {Object.entries(STAGES)
          .filter(([stage]) => stage !== 'CLOSED_LOST')
          .map(([stage, { label, color }]) => {
            const stageValue = byStage[stage]?.value ?? 0;
            const maxValue = pipelineValue || 1;
            const percentage = (stageValue / maxValue) * 100;

            return (
              <div key={stage}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="font-bold text-slate-900">{stageValue.toFixed(0)} €</span>
                </div>
                <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
                  <div
                    className={`h-full ${color} flex items-center justify-end pr-3 transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  >
                    {percentage > 15 && (
                      <span className="text-xs font-semibold text-white">
                        {percentage.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {byStage[stage]?.count ?? 0} opportunité
                  {(byStage[stage]?.count ?? 0) > 1 ? 's' : ''}
                </p>
              </div>
            );
          })}
      </div>

      <div className="pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Total Pipeline</span>
          <span className="text-2xl font-bold text-indigo-600">
            {pipelineValue.toFixed(0)} €
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {filteredOpps.length} opportunité{filteredOpps.length > 1 ? 's' : ''} sur la période
        </p>
      </div>
    </div>
  );
}
