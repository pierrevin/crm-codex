import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';

import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  list() {
    return this.prisma.company.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            contacts: true,
            opportunities: true
          }
        }
      }
    });
  }

  async create(dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({ data: dto });
    await this.audit.log('company', company.id, 'created');
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.update({ where: { id }, data: dto });
    await this.audit.log('company', id, 'updated');
    return company;
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async delete(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    // Vérifier s'il y a des contacts ou opportunités liés
    const contactCount = await this.prisma.contact.count({ where: { companyId: id } });
    const oppCount = await this.prisma.opportunity.count({ where: { companyId: id } });
    
    if (contactCount > 0 || oppCount > 0) {
      throw new Error(`Cannot delete company with ${contactCount} contact(s) and ${oppCount} opportunit(ies). Delete them first.`);
    }
    
    await this.prisma.company.delete({ where: { id } });
    await this.audit.log('company', id, 'deleted');
    return { message: 'Company deleted successfully' };
  }
}
