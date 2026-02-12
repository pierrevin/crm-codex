import { Module } from '@nestjs/common';

import { PrismaModule } from '../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService]
})
export class InvoicesModule {}
