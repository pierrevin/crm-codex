import { IsEnum, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export enum InvoiceType {
  ACOMPTE = 'ACOMPTE',
  FINAL = 'FINAL',
}

export class CreateInvoiceDto {
  @IsEnum(InvoiceType)
  type!: InvoiceType;

  @IsNumber()
  @Min(0)
  amountTTC!: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsString()
  invoiceUrl?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsString()
  opportunityId!: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
