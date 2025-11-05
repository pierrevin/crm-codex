import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GoogleService } from '../google/google.service';
import { WebhooksService } from '../webhooks/webhooks.service';

import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly google: GoogleService,
    private readonly webhooks: WebhooksService
  ) {}

  list() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { contacts: true, opportunities: true } }
      }
    });
  }

  async create(dto: CreateCompanyDto) {
    const { ownerId, tags, ...rest } = dto as any;
    const data: any = { ...rest };
    if (ownerId) data.owner = { connect: { id: ownerId } };
    if (Array.isArray(tags) && tags.length > 0) {
      data.tags = {
        connectOrCreate: tags.map((name: string) => ({
          where: { name },
          create: { name }
        }))
      };
    }
    const company = await this.prisma.company.create({ data });
    await this.audit.log('company', company.id, 'created');
    try { await this.webhooks.trigger('company.created', company); } catch {}
    // Note: Le dossier Drive entreprise sera créé lors de la création d'une opportunité (pas de dossiers vides)
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const { ownerId, tags, ...rest } = dto as any;
    const data: any = { ...rest };
    if (ownerId) data.owner = { connect: { id: ownerId } };
    if (Array.isArray(tags) && tags.length > 0) {
      data.tags = {
        connectOrCreate: tags.map((name: string) => ({
          where: { name },
          create: { name }
        }))
      };
    }
    const company = await this.prisma.company.update({ where: { id }, data });
    await this.audit.log('company', id, 'updated');
    try { await this.webhooks.trigger('company.updated', company); } catch {}
    // Note: Le dossier Drive entreprise sera créé lors de la création d'une opportunité (pas de dossiers vides)
    return company;
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        contacts: true,
        opportunities: true,
        tags: { select: { name: true } }
      }
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    // Aplatir les tags en string[] pour compatibilité frontend actuelle
    const flat = {
      ...company,
      tags: (company as any).tags?.map((t: any) => t.name) ?? []
    } as any;
    return flat;
  }

  async merge(id: string, mergeCompanyId: string) {
    if (id === mergeCompanyId) {
      throw new Error('Cannot merge a company with itself');
    }

    const mainCompany = await this.prisma.company.findUnique({
      where: { id },
      include: { tags: true }
    });
    const mergeCompany = await this.prisma.company.findUnique({
      where: { id: mergeCompanyId },
      include: { tags: true }
    });

    if (!mainCompany) {
      throw new NotFoundException(`Main company ${id} not found`);
    }
    if (!mergeCompany) {
      throw new NotFoundException(`Company to merge ${mergeCompanyId} not found`);
    }

    // Compter les données à déplacer
    const contactCount = await this.prisma.contact.count({ where: { companyId: mergeCompanyId } });
    const oppCount = await this.prisma.opportunity.count({ where: { companyId: mergeCompanyId } });

    // Déplacer les contacts
    await this.prisma.contact.updateMany({
      where: { companyId: mergeCompanyId },
      data: { companyId: id }
    });

    // Déplacer les opportunités
    await this.prisma.opportunity.updateMany({
      where: { companyId: mergeCompanyId },
      data: { companyId: id }
    });

    // Fusionner les tags (union)
    const mainTags = mainCompany.tags.map(t => t.name);
    const mergeTags = mergeCompany.tags.map(t => t.name);
    const allTags = [...new Set([...mainTags, ...mergeTags])];

    // Préparer les données à fusionner
    const updateData: any = {
      tags: {
        connectOrCreate: allTags.map((name: string) => ({
          where: { name },
          create: { name }
        }))
      }
    };

    // Fusionner les champs optionnels : si la principale est vide/null et la source a une valeur, utiliser la source
    if (!mainCompany.domain && mergeCompany.domain) updateData.domain = mergeCompany.domain;
    if (!mainCompany.externalRef && mergeCompany.externalRef) updateData.externalRef = mergeCompany.externalRef;
    if (!mainCompany.addressStreet && mergeCompany.addressStreet) updateData.addressStreet = mergeCompany.addressStreet;
    if (!mainCompany.addressZip && mergeCompany.addressZip) updateData.addressZip = mergeCompany.addressZip;
    if (!mainCompany.addressCity && mergeCompany.addressCity) updateData.addressCity = mergeCompany.addressCity;
    if (!mainCompany.addressCountry && mergeCompany.addressCountry) updateData.addressCountry = mergeCompany.addressCountry;
    if (!mainCompany.siret && mergeCompany.siret) updateData.siret = mergeCompany.siret;
    if (!mainCompany.vatNumber && mergeCompany.vatNumber) updateData.vatNumber = mergeCompany.vatNumber;
    if (!mainCompany.iban && mergeCompany.iban) updateData.iban = mergeCompany.iban;
    if (!mainCompany.bic && mergeCompany.bic) updateData.bic = mergeCompany.bic;
    if (!mainCompany.linkedinUrl && mergeCompany.linkedinUrl) updateData.linkedinUrl = mergeCompany.linkedinUrl;
    if (!mainCompany.salesNavigatorUrl && mergeCompany.salesNavigatorUrl) updateData.salesNavigatorUrl = mergeCompany.salesNavigatorUrl;
    
    // Fusionner les notes (concaténation si les deux existent)
    if (mergeCompany.notes) {
      updateData.notes = mainCompany.notes
        ? `${mainCompany.notes}\n\n--- Fusionné depuis "${mergeCompany.name}" ---\n${mergeCompany.notes}`
        : mergeCompany.notes;
    }

    // Fusionner les statuts (OR logique)
    updateData.statusClient = mainCompany.statusClient || mergeCompany.statusClient;
    updateData.statusProspect = mainCompany.statusProspect || mergeCompany.statusProspect;
    updateData.statusSupplier = mainCompany.statusSupplier || mergeCompany.statusSupplier;

    // Fusionner les dates (garder la plus ancienne pour firstInvoiceDate, la plus récente pour lastInvoiceDate)
    if (mergeCompany.firstInvoiceDate && (!mainCompany.firstInvoiceDate || mergeCompany.firstInvoiceDate < mainCompany.firstInvoiceDate)) {
      updateData.firstInvoiceDate = mergeCompany.firstInvoiceDate;
    }
    if (mergeCompany.lastInvoiceDate && (!mainCompany.lastInvoiceDate || mergeCompany.lastInvoiceDate > mainCompany.lastInvoiceDate)) {
      updateData.lastInvoiceDate = mergeCompany.lastInvoiceDate;
    }

    // Mettre à jour la company principale
    await this.prisma.company.update({
      where: { id },
      data: updateData
    });

    // Supprimer la company fusionnée
    await this.prisma.company.delete({ where: { id: mergeCompanyId } });
    
    await this.audit.log('company', id, 'merged');
    await this.audit.log('company', mergeCompanyId, 'deleted');

    return {
      message: 'Companies merged successfully',
      merged: {
        contacts: contactCount,
        opportunities: oppCount
      }
    };
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
