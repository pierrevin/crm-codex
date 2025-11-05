import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../common/prisma/prisma.module';
import { MakeTiimeController } from './make.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [MakeTiimeController]
})
export class IntegrationsModule {}


