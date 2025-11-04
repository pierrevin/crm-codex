import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ImportsService } from './imports.service';

class ImportCsvDto {
  @IsString()
  filename!: string;

  @IsString()
  csv!: string;
}

class ImportAxonautDto {
  @IsOptional()
  @IsString()
  filenameClients?: string;

  @IsString()
  clientsCsv!: string;

  @IsOptional()
  @IsString()
  filenameContacts?: string;

  @IsString()
  contactsCsv!: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
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

  @Post('axonaut')
  importAxonaut(@Body() dto: ImportAxonautDto) {
    return this.importsService.importAxonaut({
      filenameClients: dto.filenameClients ?? 'Save_clients_Axonaut.csv',
      filenameContacts: dto.filenameContacts ?? 'Save_contacts_Axonaut.csv',
      clientsCsv: dto.clientsCsv,
      contactsCsv: dto.contactsCsv,
      dryRun: dto.dryRun ?? false
    });
  }

  @Post('axonaut/files')
  importAxonautFromFiles(@Query('dryRun') dryRun?: string) {
    const isDry = (dryRun ?? 'true').toString().toLowerCase() === 'true';
    return this.importsService.importAxonautFromServerFiles(isDry);
  }
}
