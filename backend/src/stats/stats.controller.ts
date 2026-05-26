import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PipelineStatsService } from './pipeline-stats.service';
import { RevenueStatsService } from './revenue-stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/stats')
export class StatsController {
  constructor(
    private readonly pipelineStats: PipelineStatsService,
    private readonly revenueStats: RevenueStatsService
  ) {}

  // Endpoint historique pour compatibilité : retourne les stats pipeline
  @Get()
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'stages', required: false, type: [String] })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  getStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('stages') stages?: string | string[],
    @Query('ownerId') ownerId?: string
  ) {
    return this.getPipelineStats(dateFrom, dateTo, stages, ownerId);
  }

  @Get('pipeline')
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'stages', required: false, type: [String] })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  getPipelineStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('stages') stages?: string | string[],
    @Query('ownerId') ownerId?: string
  ) {
    let stagesArray: string[] | undefined;

    if (Array.isArray(stages)) {
      stagesArray = stages
        .flatMap(value => value.split(','))
        .map(s => s.trim())
        .filter(Boolean);
    } else if (typeof stages === 'string') {
      stagesArray = stages
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    return this.pipelineStats.getPipelineStats({
      dateFrom,
      dateTo,
      stages: stagesArray,
      ownerId
    });
  }

  @Get('revenue')
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  getRevenueStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('ownerId') ownerId?: string,
    @Query('companyId') companyId?: string
  ) {
    return this.revenueStats.getRevenueStats({
      dateFrom,
      dateTo,
      ownerId,
      companyId
    });
  }
}

