import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get()
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(@Query('cursor') cursor?: string, @Query('limit') limit = '20') {
    return this.opportunities.list(cursor, Number(limit));
  }

  @Post()
  create(@Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.opportunities.update(id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.opportunities.findOne(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.opportunities.delete(id);
  }
}
