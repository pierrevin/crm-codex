import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';

import { CreateWebhookDto } from './dto/create-webhook.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly audit: AuditService
  ) {}

  list() {
    return this.prisma.webhook.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateWebhookDto) {
    const webhook = await this.prisma.webhook.create({ data: dto });
    await this.audit.log('webhook', webhook.id, 'created');
    return webhook;
  }

  async trigger(event: string, payload: unknown) {
    const hooks = await this.prisma.webhook.findMany({ where: { event } });
    await Promise.all(
      hooks.map(async (hook) => {
        try {
          await firstValueFrom(
            this.http.post(hook.url, { event, payload, sentAt: new Date().toISOString() })
          );
          this.logger.log(`Webhook ${hook.id} sent`);
        } catch (error) {
          this.logger.error(`Failed to deliver webhook ${hook.id}`, error as Error);
        }
      })
    );
  }
}
