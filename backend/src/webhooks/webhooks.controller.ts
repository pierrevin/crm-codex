import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list() {
    return this.webhooks.list();
  }

  @Post()
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooks.create(dto);
  }

  @Post(':event')
  async trigger(@Param('event') event: string, @Body() payload: unknown) {
    await this.webhooks.trigger(event, payload);
    return { status: 'ok' };
  }
}
