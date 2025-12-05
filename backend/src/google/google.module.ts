import { Module } from '@nestjs/common';

import { ActivitiesModule } from '../activities/activities.module';
import { UsersModule } from '../users/users.module';

import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleDocsService } from './google-docs.service';

@Module({
  imports: [UsersModule, ActivitiesModule],
  controllers: [GoogleController],
  providers: [GoogleService, GoogleDocsService],
  exports: [GoogleService, GoogleDocsService]
})
export class GoogleModule {}
