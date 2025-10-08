import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ActivitiesModule } from './activities/activities.module';
import { appConfig } from './config/app.config';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { ContactsModule } from './contacts/contacts.module';
import { GoogleModule } from './google/google.module';
import { ImportsModule } from './imports/imports.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig]
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100
      }
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ContactsModule,
    CompaniesModule,
    OpportunitiesModule,
    ActivitiesModule,
    ImportsModule,
    WebhooksModule,
    GoogleModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule {}
