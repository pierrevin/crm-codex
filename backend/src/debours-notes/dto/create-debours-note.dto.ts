import { IsString, IsNumber, IsDateString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeboursNoteStatus } from '@prisma/client';

export class CreateDeboursNoteDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedPaymentDate?: string;

  @ApiProperty()
  @IsNumber()
  totalAmount!: number;

  @ApiProperty({ required: false, enum: DeboursNoteStatus })
  @IsOptional()
  @IsEnum(DeboursNoteStatus)
  status?: DeboursNoteStatus;

  @ApiProperty()
  @IsString()
  opportunityId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expenseIds?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  templateId?: string;
}

