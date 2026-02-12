import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  opportunityId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  deboursNoteId?: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

