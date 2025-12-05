import { Module } from '@nestjs/common';

import { PrismaModule } from '../common/prisma/prisma.module';

import { TreasuryBalanceService } from './treasury-balance.service';

@Module({
  imports: [PrismaModule],
  providers: [TreasuryBalanceService],
  exports: [TreasuryBalanceService]
})
export class TreasuryModule {}

