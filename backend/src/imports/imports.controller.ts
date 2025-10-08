import { IsString } from 'class-validator';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ImportsService } from './imports.service';

class ImportCsvDto {
  @IsString()
  filename!: string;

  @IsString()
  csv!: string;
}

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('csv')
  importCsv(@Body() dto: ImportCsvDto) {
    return this.importsService.importCsv(dto.filename, dto.csv);
  }
}
