import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfig } from '../../config/app.config';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService<AppConfig>) {
    const appConfig = configService.get('app', { infer: true });
    if (!appConfig) {
      throw new Error('Application configuration missing');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwt.accessSecret
    });
  }

  validate(payload: { sub: string }) {
    return { userId: payload.sub };
  }
}
