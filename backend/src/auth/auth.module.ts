import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    PrismaModule,
    UsersModule,
    AuditModule
  ],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
