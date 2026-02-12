import { IsEnum, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { InvoiceType } from './create-invoice.dto';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountTTC?: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsString()
  invoiceUrl?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
