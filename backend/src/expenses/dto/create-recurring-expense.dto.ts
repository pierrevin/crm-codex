import { IsOptional, IsString, IsNumber, IsDateString, IsEnum, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RecurrenceType } from '@prisma/client';

export class CreateRecurringExpenseDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  amountHT?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  amountTTC?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  vatRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountLabel?: string;

  @ApiProperty({ enum: RecurrenceType, default: 'MONTHLY' })
  @IsOptional()
  @IsEnum(RecurrenceType)
  recurrenceType?: RecurrenceType;

  @ApiProperty({ description: 'Jour du mois pour le paiement (1-31)', minimum: 1, maximum: 31 })
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay: number;

  @ApiProperty({ description: 'Date de début de la récurrence' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false, description: 'Date de fin optionnelle' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  opportunityId?: string;
}
