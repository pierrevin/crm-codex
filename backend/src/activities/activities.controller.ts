import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(@Query('cursor') cursor?: string, @Query('limit') limit = '20') {
    return this.activities.list(cursor, Number(limit));
  }

  @Post()
  create(@Body() dto: CreateActivityDto) {
    return this.activities.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activities.update(id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activities.findOne(id);
  }
}
