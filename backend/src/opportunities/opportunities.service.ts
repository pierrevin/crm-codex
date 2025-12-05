import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { GoogleService } from '../google/google.service';

import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    private readonly google: GoogleService
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
      closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined,
      expectedPaymentDate: dto.expectedPaymentDate ? new Date(dto.expectedPaymentDate) : undefined,
      taxRate: dto.taxRate ?? 0.27 // Par défaut 27%
    };
    const opportunity = await this.prisma.opportunity.create({ data });
    await this.audit.log('opportunity', opportunity.id, 'created');
    // S'assurer des dossiers Drive
    try {
      const company = opportunity.companyId
        ? await this.prisma.company.findUnique({ where: { id: opportunity.companyId } })
        : null;
      if (company) {
        await this.google.ensureCompanyFolder(company as any);
        await this.google.ensureOpportunityFolder(company as any, opportunity as any);
      }
    } catch (e) {
      // silencieux
    }
    await this.webhooks.trigger('opportunity.created', opportunity);
    return opportunity;
  }

  async update(id: string, dto: UpdateOpportunityDto) {
    const data: any = {
      ...dto,
      closeDate: dto.closeDate ? new Date(dto.closeDate) : undefined,
      expectedPaymentDate: dto.expectedPaymentDate ? new Date(dto.expectedPaymentDate) : undefined
    };
    
    // Si taxRate est fourni, l'inclure, sinon garder la valeur existante
    if (dto.taxRate !== undefined) {
      data.taxRate = dto.taxRate;
    }
    const before = await this.prisma.opportunity.findUnique({ where: { id } });
    const opportunity = await this.prisma.opportunity.update({ where: { id }, data });
    await this.audit.log('opportunity', id, 'updated');
    // Renommer dossier si changement de stage
    try {
      if (before && dto.stage && before.stage !== dto.stage) {
        const createdAt = opportunity.createdAt ?? new Date();
        const yyyymmdd = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '');
        const titleSane = (opportunity.title || 'Opportunity').substring(0, 60);
        const newName = `${yyyymmdd}_${titleSane}_${opportunity.stage}`;
        await this.google.renameOpportunityFolder(opportunity as any, newName);
        await this.webhooks.trigger('opportunity.stage_changed', { ...opportunity, previousStage: before.stage });
      } else {
    await this.webhooks.trigger('opportunity.updated', opportunity);
      }
    } catch (e) {
      // silencieux
    }
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
