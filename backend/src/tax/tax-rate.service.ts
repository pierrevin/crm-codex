import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TaxRateService {
  constructor(private readonly prisma: PrismaService) {}

  async getRateForDate(date: Date): Promise<number> {
    const configs = await this.prisma.taxRateConfig.findMany({
      where: {
        effectiveFrom: {
          lte: date
        }
      },
      orderBy: {
        effectiveFrom: 'desc'
      },
      take: 1
    });

    if (configs.length === 0) {
      // Fallback si aucune config n'est encore définie
      return 0.28;
    }

    return Number(configs[0].rate);
  }

  async listAll() {
    return this.prisma.taxRateConfig.findMany({
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  async create(config: { rate: number; label?: string; effectiveFrom: Date }) {
    return this.prisma.taxRateConfig.create({
      data: {
        rate: config.rate,
        label: config.label,
        effectiveFrom: config.effectiveFrom
      }
    });
  }
}

