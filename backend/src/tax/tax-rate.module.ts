import { Module } from '@nestjs/common';

import { PrismaModule } from '../common/prisma/prisma.module';

import { TaxRateController } from './tax-rate.controller';
import { TaxRateService } from './tax-rate.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaxRateController],
  providers: [TaxRateService],
  exports: [TaxRateService]
})
export class TaxRateModule {}

