import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecurringExpensesService } from './recurring-expenses.service';
import {
  CreateRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from './dto';

@ApiTags('recurring-expenses')
@ApiBearerAuth()
@Controller('api/recurring-expenses')
export class RecurringExpensesController {
  constructor(
    private readonly recurringExpensesService: RecurringExpensesService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateRecurringExpenseDto,
    @Req() req: FastifyRequest
  ) {
    const userId = (req as any).user?.userId;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    return this.recurringExpensesService.create(dto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: FastifyRequest) {
    const userId = (req as any).user?.userId;
    return this.recurringExpensesService.findAll(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.recurringExpensesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRecurringExpenseDto
  ) {
    return this.recurringExpensesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.recurringExpensesService.delete(id);
  }

  @Post(':id/generate')
  @UseGuards(JwtAuthGuard)
  async generateForecast(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    // Par défaut, générer pour les 12 prochains mois
    if (!endDate) {
      end.setMonth(end.getMonth() + 12);
    }
    return this.recurringExpensesService.generateForecastExpenses(
      id,
      start,
      end
    );
  }
}
