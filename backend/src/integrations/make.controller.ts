import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../common/prisma/prisma.service';
import { AppConfig } from '../config/app.config';

class TiimeQuoteDto {
  opportunityId!: string;
  tiimeQuoteId!: string;
  quoteUrl!: string;
}

class TiimeInvoiceDto {
  opportunityId!: string;
  tiimeInvoiceId!: string;
  invoiceUrl!: string;
}

class TiimeCompanyDto {
  companyId!: string;
  tiimeId!: string;
}

@ApiTags('integrations')
@Controller('api/integrations/make/tiime')
export class MakeTiimeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private verifySecret(secret?: string) {
    const cfg = this.config.get<AppConfig>('app')!;
    if (!cfg.makeWebhookSecret || secret !== cfg.makeWebhookSecret) {
      throw new Error('Invalid signature');
    }
  }

  @Post('quote')
  async quote(@Headers('x-make-signature') sig: string | undefined, @Body() dto: TiimeQuoteDto) {
    this.verifySecret(sig);
    await this.prisma.opportunity.update({
      where: { id: dto.opportunityId },
      data: {
        tiimeQuoteId: dto.tiimeQuoteId,
        quoteUrl: dto.quoteUrl
      }
    });
    return { status: 'ok' };
  }

  @Post('invoice')
  async invoice(@Headers('x-make-signature') sig: string | undefined, @Body() dto: TiimeInvoiceDto) {
    this.verifySecret(sig);
    const opp = await this.prisma.opportunity.findUnique({ where: { id: dto.opportunityId } });
    if (!opp) return { status: 'ignored' };
    const nextInvoiceIds = Array.isArray((opp as any).tiimeInvoiceIds) ? [...(opp as any).tiimeInvoiceIds] : [];
    const nextInvoiceUrls = Array.isArray((opp as any).invoiceUrls) ? [...(opp as any).invoiceUrls] : [];
    if (!nextInvoiceIds.includes(dto.tiimeInvoiceId)) nextInvoiceIds.push(dto.tiimeInvoiceId);
    if (!nextInvoiceUrls.includes(dto.invoiceUrl)) nextInvoiceUrls.push(dto.invoiceUrl);
    await this.prisma.opportunity.update({
      where: { id: dto.opportunityId },
      data: { tiimeInvoiceIds: nextInvoiceIds as any, invoiceUrls: nextInvoiceUrls as any }
    });
    return { status: 'ok' };
  }

  @Post('company')
  async company(@Headers('x-make-signature') sig: string | undefined, @Body() dto: TiimeCompanyDto) {
    this.verifySecret(sig);
    await this.prisma.company.update({ where: { id: dto.companyId }, data: { tiimeId: dto.tiimeId } });
    return { status: 'ok' };
  }
}


