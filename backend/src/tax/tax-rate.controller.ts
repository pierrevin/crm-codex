import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { TaxRateService } from './tax-rate.service';

class CreateTaxRateDto {
  rate!: number; // ex: 0.28 pour 28%
  label?: string;
  effectiveFrom!: string; // ISO date string
}

@ApiTags('tax-rates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/tax-rates')
export class TaxRateController {
  constructor(private readonly taxRates: TaxRateService) {}

  @Get()
  list() {
    return this.taxRates.listAll();
  }

  @Post()
  async create(@Body() dto: CreateTaxRateDto) {
    const effectiveFrom = new Date(dto.effectiveFrom);
    return this.taxRates.create({
      rate: dto.rate,
      label: dto.label,
      effectiveFrom
    });
  }
}

