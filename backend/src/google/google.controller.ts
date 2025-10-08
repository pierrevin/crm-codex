import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { GoogleService } from './google.service';

class GoogleCallbackDto {
  code!: string;
}

@ApiTags('google')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/google')
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  @Get('oauth-url')
  async oauthUrl(@Req() req: any) {
    return this.google.generateAuthUrl(req.user.userId);
  }

  @Post('callback')
  async callback(@Req() req: any, @Body() dto: GoogleCallbackDto) {
    return this.google.handleOAuthCallback(dto.code, req.user.userId);
  }

  @Post('sync-calendar')
  async syncCalendar(@Req() req: any) {
    return this.google.syncCalendar(req.user.userId);
  }

  @Get('gmail/messages')
  async gmailMessages(@Req() req: any) {
    return this.google.fetchGmailMessages(req.user.userId);
  }
}
