import { Injectable } from '@nestjs/common';

import { OpportunityStage } from '@prisma/client';

import { PrismaService } from '../common/prisma/prisma.service';
import { TaxRateService } from '../tax/tax-rate.service';

type GetStatsParams = {
  dateFrom?: string;
  dateTo?: string;
  stages?: string[];
};

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxRates: TaxRateService
  ) {}

  private async getAverageTaxRate(dateFrom?: Date, dateTo?: Date): Promise<number> {
    if (!dateFrom || !dateTo) {
      return this.taxRates.getRateForDate(new Date());
    }

    const configs = await this.taxRates.listAll();

    if (!configs || configs.length === 0) {
      return 0.28;
    }

    const sorted = [...configs].sort(
      (a: any, b: any) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
    );

    const periodStart = dateFrom;
    const periodEnd = dateTo;
    const totalMs = periodEnd.getTime() - periodStart.getTime();

    if (totalMs <= 0) {
      return Number(sorted[sorted.length - 1].rate);
    }

    let weightedSum = 0;
    let coveredMs = 0;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      const segmentStart = current.effectiveFrom;
      const segmentEnd = next ? next.effectiveFrom : periodEnd;

      const clampedStart = segmentStart < periodStart ? periodStart : segmentStart;
      const clampedEnd = segmentEnd > periodEnd ? periodEnd : segmentEnd;

      if (clampedEnd <= clampedStart) continue;

      const duration = clampedEnd.getTime() - clampedStart.getTime();
      const rate = Number(current.rate);

      weightedSum += rate * duration;
      coveredMs += duration;
    }

    if (coveredMs === 0) {
      return this.taxRates.getRateForDate(periodEnd);
    }

    return weightedSum / coveredMs;
  }

  async getStats(params: GetStatsParams) {
    const { dateFrom, dateTo, stages } = params;

    const fromDate = dateFrom ? new Date(dateFrom) : undefined;
    const toDate = dateTo ? new Date(dateTo) : undefined;

    const stageFilter =
      stages && stages.length > 0
        ? (stages.filter(Boolean) as OpportunityStage[])
        : undefined;

    const opportunityWhere: any = {};

    // Log minimal pour comprendre les filtres appliqués en runtime
    // (à retirer ou réduire si trop verbeux une fois stabilisé)
    // eslint-disable-next-line no-console
    console.log('StatsService.getStats params', {
      dateFrom,
      dateTo,
      stages: stageFilter
    });

    if (stageFilter) {
      opportunityWhere.stage = { in: stageFilter };
    }

    // Filtre de période basé sur la date de clôture (closeDate),
    // pour que le CA validé et le pipeline soient bien liés à la période sélectionnée.
    if (fromDate || toDate) {
      opportunityWhere.closeDate = {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate })
      };
    }

    const [totalContacts, totalCompanies, opportunities, totalOpportunities, averageTaxRate] =
      await Promise.all([
        this.prisma.contact.count(),
        this.prisma.company.count(),
        this.prisma.opportunity.findMany({
          where: opportunityWhere,
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        this.prisma.opportunity.count({ where: opportunityWhere }),
        this.getAverageTaxRate(fromDate, toDate)
      ]);

    const opportunitiesByStage: Record<string, number> = {};
    let pipelineValue = 0;
    let wonValue = 0;

    for (const opp of opportunities) {
      const stageKey = opp.stage as OpportunityStage;
      opportunitiesByStage[stageKey] = (opportunitiesByStage[stageKey] || 0) + 1;

      const amount = Number(opp.amount) || 0;

      if (stageKey !== OpportunityStage.CLOSED_LOST) {
        pipelineValue += amount;
      }

      if (stageKey === OpportunityStage.CLOSED_WON) {
        wonValue += amount;
      }
    }

    const netRevenue = wonValue * (1 - averageTaxRate);
    const recentOpportunities = opportunities.slice(0, 5);

    // eslint-disable-next-line no-console
    console.log('StatsService.getStats aggregates', {
      fromDate,
      toDate,
      stageFilter,
      opportunitiesCount: opportunities.length,
      totalOpportunities,
      wonValue,
      pipelineValue
    });

    return {
      totalContacts,
      totalCompanies,
      totalOpportunities,
      pipelineValue,
      wonValue,
      netRevenue,
      averageTaxRate,
      opportunitiesByStage,
      recentOpportunities
    };
  }
}

