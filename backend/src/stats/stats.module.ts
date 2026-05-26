import { Module } from '@nestjs/common';

import { PrismaModule } from '../common/prisma/prisma.module';
import { TaxRateModule } from '../tax/tax-rate.module';

import { StatsController } from './stats.controller';
import { PipelineStatsService } from './pipeline-stats.service';
import { RevenueStatsService } from './revenue-stats.service';

@Module({
  imports: [PrismaModule, TaxRateModule],
  controllers: [StatsController],
  providers: [PipelineStatsService, RevenueStatsService]
})
export class StatsModule {}

