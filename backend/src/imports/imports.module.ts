import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ContactsModule } from '../contacts/contacts.module';
import { PrismaModule } from '../common/prisma/prisma.module';

import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [PrismaModule, ContactsModule, AuditModule],
  controllers: [ImportsController],
  providers: [ImportsService]
})
export class ImportsModule {}
