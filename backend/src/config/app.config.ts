import { registerAs } from '@nestjs/config';

type AppConfigKeys = {
  port: number;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  webAppUrl: string;
  admin: {
    email: string;
    password: string;
  };
};

export type AppConfig = AppConfigKeys;

export const appConfig = registerAs<AppConfig>('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '900s',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? ''
  },
  webAppUrl: process.env.WEB_APP_URL ?? 'http://localhost:5173',
  admin: {
    email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
    password: process.env.ADMIN_PASSWORD ?? 'ChangeMe123!'
  }
}));
