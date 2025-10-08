import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [PrismaModule, AuditModule, WebhooksModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService]
})
export class ContactsModule {}
