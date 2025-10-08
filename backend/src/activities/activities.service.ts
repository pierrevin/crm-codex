import { Injectable, NotFoundException } from '@nestjs/common';

import { ActivityType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService
  ) {}

  async list(cursor: string | undefined, limit: number) {
    const data = await this.prisma.activity.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: { contact: true, opportunity: true },
      orderBy: { createdAt: 'desc' }
    });
    const nextCursor = data.length === limit ? data[data.length - 1].id : null;
    return { data, nextCursor };
  }

  async upsertGoogleEvent(eventId: string, subject: string, description?: string, dueDate?: string) {
    const existing = await this.prisma.activity.findUnique({ where: { googleEventId: eventId } });
    const activity = await this.prisma.activity.upsert({
      where: { googleEventId: eventId },
      update: {
        subject,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined
      },
      create: {
        type: ActivityType.EVENT,
        subject,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        googleEventId: eventId
      }
    });
    if (!existing) {
      await this.audit.log('activity', activity.id, 'created');
      await this.webhooks.trigger('activity.created', activity);
    }
    return activity;
  }

  async create(dto: CreateActivityDto) {
    const activity = await this.prisma.activity.create({
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined
      }
    });
    await this.audit.log('activity', activity.id, 'created');
    await this.webhooks.trigger('activity.created', activity);
    return activity;
  }

  async update(id: string, dto: UpdateActivityDto) {
    const activity = await this.prisma.activity.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined
      }
    });
    await this.audit.log('activity', id, 'updated');
    return activity;
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: { contact: true, opportunity: true }
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return activity;
  }
}
