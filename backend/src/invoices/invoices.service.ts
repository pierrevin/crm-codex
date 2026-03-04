import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TaxRateService } from '../tax/tax-rate.service';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly taxRates: TaxRateService
  ) {}

  async create(dto: CreateInvoiceDto) {
    // Vérifier que l'opportunité existe
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: dto.opportunityId }
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    // Utiliser le taxRate de l'opportunité si non fourni, sinon résoudre via la config
    let taxRate = dto.taxRate;
    if (taxRate === undefined) {
      if (opportunity.taxRate) {
        taxRate = Number(opportunity.taxRate);
      } else {
        const referenceDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
        taxRate = await this.taxRates.getRateForDate(referenceDate);
      }
    }
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();

    const invoice = await this.prisma.invoice.create({
      data: {
        type: dto.type,
        amountTTC: dto.amountTTC,
        taxRate,
        invoiceUrl: dto.invoiceUrl,
        invoiceNumber: dto.invoiceNumber,
        opportunityId: dto.opportunityId,
        issueDate,
        notes: dto.notes
      },
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        },
        payments: true
      }
    });

    await this.audit.log('invoice', invoice.id, 'created');
    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const existingInvoice = await this.prisma.invoice.findUnique({
      where: { id }
    });

    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found');
    }

    const updateData: any = {};

    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.amountTTC !== undefined) updateData.amountTTC = dto.amountTTC;
    if (dto.taxRate !== undefined) updateData.taxRate = dto.taxRate;
    if (dto.invoiceUrl !== undefined) updateData.invoiceUrl = dto.invoiceUrl;
    if (dto.invoiceNumber !== undefined) updateData.invoiceNumber = dto.invoiceNumber;
    if (dto.issueDate !== undefined) updateData.issueDate = new Date(dto.issueDate);
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        },
        payments: true
      }
    });

    await this.audit.log('invoice', id, 'updated');
    return invoice;
  }

  async delete(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { payments: true }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Vérifier qu'aucun paiement n'est lié
    if (invoice.payments.length > 0) {
      throw new BadRequestException('Cannot delete invoice with linked payments');
    }

    await this.prisma.invoice.delete({ where: { id } });
    await this.audit.log('invoice', id, 'deleted');
    return { message: 'Invoice deleted successfully' };
  }

  async findByOpportunity(opportunityId: string) {
    return this.prisma.invoice.findMany({
      where: { opportunityId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { issueDate: 'desc' }
    });
  }

  async findAll(filters?: {
    opportunityId?: string;
  }) {
    const where: any = {};

    if (filters?.opportunityId) {
      where.opportunityId = filters.opportunityId;
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { issueDate: 'desc' }
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }
}
