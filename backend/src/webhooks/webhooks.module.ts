import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';

import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PrismaModule, HttpModule, AuditModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService]
})
export class WebhooksModule {}
