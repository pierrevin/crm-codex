import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { addSeconds } from 'date-fns';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AppConfig } from '../config/app.config';
import { ConfigService } from '@nestjs/config';

import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TokensDto } from './dto/tokens.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(dto: LoginDto): Promise<TokensDto> {
    const user = await this.validateUser(dto.email, dto.password);
    return this.issueTokens(user.id);
  }

  async refresh(dto: RefreshDto): Promise<TokensDto> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken }
    });
    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid');
    }
    const appConfig = this.config.get<AppConfig>('app')!;
    await this.jwtService.verifyAsync(dto.refreshToken, {
      secret: appConfig.jwt.refreshSecret
    });
    return this.issueTokens(existing.userId, dto.refreshToken);
  }

  private async issueTokens(userId: string, reuseToken?: string): Promise<TokensDto> {
    const appConfig = this.config.get<AppConfig>('app')!;
    const payload = { sub: userId };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: appConfig.jwt.accessSecret,
      expiresIn: appConfig.jwt.accessExpiresIn
    });
    let refreshToken = reuseToken;
    let expiresAt: Date;
    if (!reuseToken) {
      refreshToken = await this.jwtService.signAsync(payload, {
        secret: appConfig.jwt.refreshSecret,
        expiresIn: appConfig.jwt.refreshExpiresIn
      });
      const ttlSeconds = this.parseSeconds(appConfig.jwt.refreshExpiresIn);
      expiresAt = addSeconds(new Date(), ttlSeconds);
      await this.prisma.refreshToken.create({
        data: { token: refreshToken, userId, expiresAt }
      });
    } else {
      expiresAt = addSeconds(new Date(), this.parseSeconds(appConfig.jwt.refreshExpiresIn));
      await this.prisma.refreshToken.update({
        where: { token: reuseToken },
        data: { expiresAt }
      });
    }
    await this.auditService.log('auth', userId, 'token.issued', userId);
    return { accessToken, refreshToken: refreshToken! };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private parseSeconds(duration: string): number {
    if (duration.endsWith('s')) {
      return Number.parseInt(duration.replace('s', ''), 10);
    }
    if (duration.endsWith('m')) {
      return Number.parseInt(duration.replace('m', ''), 10) * 60;
    }
    if (duration.endsWith('h')) {
      return Number.parseInt(duration.replace('h', ''), 10) * 60 * 60;
    }
    if (duration.endsWith('d')) {
      return Number.parseInt(duration.replace('d', ''), 10) * 60 * 60 * 24;
    }
    return Number.parseInt(duration, 10);
  }
}
