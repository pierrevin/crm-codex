import { IsOptional, IsString, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExpenseStatus } from '@prisma/client';

export class CreateExpenseDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

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
  fileUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountLabel?: string;

  @ApiProperty({ required: false, enum: ExpenseStatus })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyId?: string;
}

