import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

import { ActivitiesService } from '../activities/activities.service';
import { AppConfig } from '../config/app.config';
import { UsersService } from '../users/users.service';

@Injectable()
export class GoogleService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly activities: ActivitiesService
  ) {}

  private getOAuthClient() {
    const cfg = this.config.get<AppConfig>('app')!;
    if (!cfg) {
      throw new Error('Google configuration missing');
    }
    const client = new google.auth.OAuth2(
      cfg.google.clientId,
      cfg.google.clientSecret,
      cfg.google.redirectUri
    );
    return client;
  }

  async generateAuthUrl(userId: string) {
    const client = this.getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: userId
    });
    return { url };
  }

  async handleOAuthCallback(code: string, userId: string) {
    const client = this.getOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new UnauthorizedException('Missing refresh token');
    }
    await this.users.update(userId, { googleRefreshToken: tokens.refresh_token });
    return { status: 'connected' };
  }

  async fetchGmailMessages(userId: string) {
    const user = await this.users.getById(userId);
    if (!user.googleRefreshToken) {
      throw new UnauthorizedException('Google account not connected');
    }
    const client = this.getOAuthClient();
    client.setCredentials({ refresh_token: user.googleRefreshToken });
    const gmail = google.gmail({ version: 'v1', auth: client });
    const { data } = await gmail.users.messages.list({ userId: 'me', maxResults: 5 });
    const messages = await Promise.all(
      (data.messages ?? []).map(async (message) => {
        const details = await gmail.users.messages.get({ userId: 'me', id: message.id ?? '' });
        const headers = details.data.payload?.headers ?? [];
        const subject = headers.find((header) => header.name === 'Subject')?.value;
        const from = headers.find((header) => header.name === 'From')?.value;
        return { id: message.id ?? '', subject, from, snippet: details.data.snippet };
      })
    );
    return messages;
  }

  async syncCalendar(userId: string) {
    const user = await this.users.getById(userId);
    if (!user.googleRefreshToken) {
      throw new UnauthorizedException('Google account not connected');
    }
    const client = this.getOAuthClient();
    client.setCredentials({ refresh_token: user.googleRefreshToken });
    const calendar = google.calendar({ version: 'v3', auth: client });
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    const events = data.items ?? [];
    for (const event of events) {
      if (!event.id || !event.summary) {
        continue;
      }
      await this.activities.upsertGoogleEvent(
        event.id,
        event.summary,
        event.description ?? undefined,
        event.start?.dateTime ?? event.start?.date ?? undefined
      );
    }
    return { imported: events.length };
  }
}
