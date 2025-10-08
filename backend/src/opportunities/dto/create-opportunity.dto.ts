import { IsEnum, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

import { OpportunityStage } from '@prisma/client';

export class CreateOpportunityDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsDateString()
  closeDate?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
