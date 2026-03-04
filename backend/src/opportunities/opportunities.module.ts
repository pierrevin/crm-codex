import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { GoogleModule } from '../google/google.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TaxRateModule } from '../tax/tax-rate.module';

import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [PrismaModule, AuditModule, WebhooksModule, GoogleModule, TaxRateModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService]
})
export class OpportunitiesModule {}
