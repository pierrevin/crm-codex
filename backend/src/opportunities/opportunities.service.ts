import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService
  ) {}

  async list(cursor: string | undefined, limit: number) {
    const data = await this.prisma.opportunity.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: { contact: true, company: true },
      orderBy: { createdAt: 'desc' }
    });
    const nextCursor = data.length === limit ? data[data.length - 1].id : null;
    return { data, nextCursor };
  }

  async create(dto: CreateOpportunityDto) {
    const data = {
      ...dto,
      closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined
    };
    const opportunity = await this.prisma.opportunity.create({ data });
    await this.audit.log('opportunity', opportunity.id, 'created');
    await this.webhooks.trigger('opportunity.updated', opportunity);
    return opportunity;
  }

  async update(id: string, dto: UpdateOpportunityDto) {
    const data = {
      ...dto,
      closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined
    };
    const opportunity = await this.prisma.opportunity.update({ where: { id }, data });
    await this.audit.log('opportunity', id, 'updated');
    await this.webhooks.trigger('opportunity.updated', opportunity);
    return opportunity;
  }

  async findOne(id: string) {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { contact: true, company: true }
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    return opportunity;
  }

  async delete(id: string) {
    const opportunity = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    await this.prisma.opportunity.delete({ where: { id } });
    await this.audit.log('opportunity', id, 'deleted');
    return { message: 'Opportunity deleted successfully' };
  }
}
