import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async create(dto: CreatePaymentDto) {
    // Valider qu'au moins un des deux est fourni
    if (!dto.opportunityId && !dto.deboursNoteId) {
      throw new NotFoundException('Either opportunityId or deboursNoteId must be provided');
    }

    let taxRate = dto.taxRate ?? 0.27;
    let taxAmount = dto.amount * taxRate;

    // Si c'est une opportunité, récupérer le taux de taxe depuis l'opportunité
    if (dto.opportunityId) {
      const opportunity = await this.prisma.opportunity.findUnique({
        where: { id: dto.opportunityId }
      });
      if (!opportunity) {
        throw new NotFoundException('Opportunity not found');
      }
      taxRate = dto.taxRate ?? (opportunity.taxRate ? Number(opportunity.taxRate) : 0.27);
      taxAmount = dto.amount * taxRate;
    }

    // Si c'est une note de débours, les notes de débours ne sont généralement pas soumises à taxe
    if (dto.deboursNoteId) {
      const deboursNote = await this.prisma.deboursNote.findUnique({
        where: { id: dto.deboursNoteId }
      });
      if (!deboursNote) {
        throw new NotFoundException('DeboursNote not found');
      }
      // Notes de débours : pas de taxe (0%)
      taxRate = 0;
      taxAmount = 0;
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const payment = await this.prisma.payment.create({
      data: {
        opportunityId: dto.opportunityId,
        deboursNoteId: dto.deboursNoteId,
        amount: dto.amount,
        paymentDate,
        taxRate,
        taxAmount,
        notes: dto.notes
      },
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        },
        deboursNote: {
          include: {
            opportunity: {
              include: {
                company: true
              }
            }
          }
        }
      }
    });

    await this.audit.log('payment', payment.id, 'created');
    return payment;
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const existingPayment = await this.prisma.payment.findUnique({
      where: { id },
      include: { opportunity: true }
    });

    if (!existingPayment) {
      throw new NotFoundException('Payment not found');
    }

    // Recalculer les taxes si le montant ou le taux change
    let taxRate = existingPayment.taxRate;
    let taxAmount = existingPayment.taxAmount;
    let amount = existingPayment.amount;

    if (dto.taxRate !== undefined || dto.amount !== undefined) {
      taxRate = dto.taxRate ?? Number(existingPayment.taxRate);
      amount = dto.amount ?? Number(existingPayment.amount);
      taxAmount = amount * Number(taxRate);
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : existingPayment.paymentDate;

    const payment = await this.prisma.payment.update({
      where: { id },
      data: {
        amount,
        paymentDate,
        taxRate,
        taxAmount,
        notes: dto.notes
      },
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        },
        deboursNote: {
          include: {
            opportunity: {
              include: {
                company: true
              }
            }
          }
        }
      }
    });

    await this.audit.log('payment', id, 'updated');
    return payment;
  }

  async delete(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    await this.prisma.payment.delete({ where: { id } });
    await this.audit.log('payment', id, 'deleted');
    return { message: 'Payment deleted successfully' };
  }

  async findByOpportunity(opportunityId: string) {
    return this.prisma.payment.findMany({
      where: { opportunityId },
      orderBy: { paymentDate: 'desc' },
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        }
      }
    });
  }

  async findAll(filters?: {
    opportunityId?: string;
    deboursNoteId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters?.opportunityId) {
      where.opportunityId = filters.opportunityId;
    }

    if (filters?.deboursNoteId) {
      where.deboursNoteId = filters.deboursNoteId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.paymentDate = {};
      if (filters.startDate) {
        where.paymentDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.paymentDate.lte = filters.endDate;
      }
    }

    return this.prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        }
      }
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            company: true,
            contact: true
          }
        },
        deboursNote: {
          include: {
            opportunity: {
              include: {
                company: true
              }
            }
          }
        }
      }
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async findByDeboursNote(deboursNoteId: string) {
    return this.prisma.payment.findMany({
      where: { deboursNoteId },
      orderBy: { paymentDate: 'desc' },
      include: {
        deboursNote: {
          include: {
            opportunity: {
              include: {
                company: true
              }
            }
          }
        }
      }
    });
  }
}

