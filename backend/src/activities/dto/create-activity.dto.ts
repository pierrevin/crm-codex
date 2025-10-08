import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  opportunityId?: string;
}
