import { IsArray, IsBoolean, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  // Axonaut enrichissements
  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsBoolean()
  isIndividual?: boolean;

  @IsOptional()
  @IsString()
  addressStreet?: string;

  @IsOptional()
  @IsString()
  addressZip?: string;

  @IsOptional()
  @IsString()
  addressCity?: string;

  @IsOptional()
  @IsString()
  addressCountry?: string;

  @IsOptional()
  @IsString()
  siret?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  bic?: string;

  @IsOptional()
  @IsString()
  rum?: string;

  @IsOptional()
  @IsBoolean()
  sepaMandateActive?: boolean;

  @IsOptional()
  @IsString()
  legacyCode?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  statusClient?: boolean;

  @IsOptional()
  @IsBoolean()
  statusProspect?: boolean;

  @IsOptional()
  @IsBoolean()
  statusSupplier?: boolean;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  salesNavigatorUrl?: string;

  @IsOptional()
  @IsDateString()
  firstInvoiceDate?: string;

  @IsOptional()
  @IsDateString()
  lastInvoiceDate?: string;

  // décimaux acceptés en string
  @IsOptional()
  @IsString()
  turnoverAllTime?: string;

  @IsOptional()
  @IsString()
  turnoverThisYear?: string;

  @IsOptional()
  @IsDateString()
  lastActivityAt?: string;

  @IsOptional()
  @IsDateString()
  nextActivityAt?: string;
}
