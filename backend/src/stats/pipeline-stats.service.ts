import { Injectable } from '@nestjs/common';

import { OpportunityStage } from '@prisma/client';

import { PrismaService } from '../common/prisma/prisma.service';

export type PipelineStatsParams = {
  dateFrom?: string;
  dateTo?: string;
  stages?: string[];
  ownerId?: string;
};

type PipelineStageKey = keyof typeof OpportunityStage;

const STAGE_WEIGHTS: Record<OpportunityStage, number> = {
  QUALIFICATION: 0.2,
  PROPOSAL: 0.5,
  NEGOTIATION: 0.7,
  CLOSED_WON: 1,
  FINALIZED: 1,
  CLOSED_LOST: 0
};

@Injectable()
export class PipelineStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPipelineStats(params: PipelineStatsParams) {
    const { dateFrom, dateTo, stages, ownerId } = params;

    const fromDate = dateFrom ? new Date(dateFrom) : undefined;
    const toDate = dateTo ? new Date(dateTo) : undefined;

    const stageFilter =
      stages && stages.length > 0
        ? (stages.filter(Boolean) as OpportunityStage[])
        : undefined;

    const where: any = {};

    if (stageFilter) {
      where.stage = { in: stageFilter };
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    // Filtre de période : on se base en priorité sur closeDate (date de gain),
    // et à défaut sur createdAt pour les opportunités encore ouvertes.
    if (fromDate || toDate) {
      where.OR = [
        {
          closeDate: {
            ...(fromDate && { gte: fromDate }),
            ...(toDate && { lte: toDate })
          }
        },
        {
          AND: [
            { closeDate: null },
            {
              createdAt: {
                ...(fromDate && { gte: fromDate }),
                ...(toDate && { lte: toDate })
              }
            }
          ]
        }
      ];
    }

    const [totalContacts, totalCompanies, opportunities] = await Promise.all([
      this.prisma.contact.count(),
      this.prisma.company.count(),
      this.prisma.opportunity.findMany({
        where,
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
      })
    ]);

    const totalOpportunities = opportunities.length;

    const opportunitiesByStage: Record<string, number> = {};
    const valueByStage: Record<string, number> = {};

    let openOpportunities = 0;
    let pipelineValue = 0;
    let weightedPipelineValue = 0;
    let wonValue = 0;

    for (const opp of opportunities) {
      const stageKey = opp.stage as OpportunityStage;
      const amount = Number(opp.amount) || 0;

      const stageName = stageKey as PipelineStageKey;

      opportunitiesByStage[stageName] = (opportunitiesByStage[stageName] || 0) + 1;
      valueByStage[stageName] = (valueByStage[stageName] || 0) + amount;

      if (stageKey !== OpportunityStage.CLOSED_LOST) {
        openOpportunities++;
        pipelineValue += amount;
        weightedPipelineValue += amount * (STAGE_WEIGHTS[stageKey] ?? 0);
      }

      if (stageKey === OpportunityStage.CLOSED_WON || stageKey === OpportunityStage.FINALIZED) {
        wonValue += amount;
      }
    }

    const wonCount =
      (opportunitiesByStage[OpportunityStage.CLOSED_WON] || 0) +
      (opportunitiesByStage[OpportunityStage.FINALIZED] || 0);

    const conversionRate =
      totalOpportunities > 0 ? (wonCount / totalOpportunities) * 100 : 0;

    const recentOpportunities = opportunities.slice(0, 5);

    const keyOpportunities = opportunities
      .filter(opp => opp.stage !== OpportunityStage.CLOSED_LOST)
      .slice(0, 10);

    return {
      totalContacts,
      totalCompanies,
      totalOpportunities,
      openOpportunities,
      pipelineValue,
      weightedPipelineValue,
      wonValue,
      conversionRate,
      opportunitiesByStage,
      valueByStage,
      recentOpportunities,
      keyOpportunities
    };
  }
}

