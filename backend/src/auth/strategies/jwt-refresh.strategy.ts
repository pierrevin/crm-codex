import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { FastifyRequest } from 'fastify';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService<AppConfig>,
    private readonly prisma: PrismaService
  ) {
    const appConfig = configService.get('app', { infer: true });
    if (!appConfig) {
      throw new Error('Application configuration missing');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwt.refreshSecret,
      passReqToCallback: true
    });
  }

  async validate(req: FastifyRequest, payload: { sub: string }) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) {
      throw new UnauthorizedException();
    }
    const existing = await this.prisma.refreshToken.findUnique({
      where: { token }
    });
    if (!existing) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, refreshToken: token };
  }
}
