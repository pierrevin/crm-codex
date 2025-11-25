import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanExpenseDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountCode?: string;
}

