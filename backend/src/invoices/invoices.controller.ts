import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiQuery({ name: 'opportunityId', required: false })
  list(@Query('opportunityId') opportunityId?: string) {
    return this.invoices.findAll({ opportunityId });
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.invoices.delete(id);
  }

  @Get('opportunity/:opportunityId')
  findByOpportunity(@Param('opportunityId') opportunityId: string) {
    return this.invoices.findByOpportunity(opportunityId);
  }
}
