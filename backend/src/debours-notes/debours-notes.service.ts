import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { GoogleDocsService } from '../google/google-docs.service';
import { GoogleService } from '../google/google.service';
import { CreateDeboursNoteDto, UpdateDeboursNoteDto } from './dto';

@Injectable()
export class DeboursNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleDocs: GoogleDocsService,
    private readonly googleService: GoogleService
  ) {}

  async create(dto: CreateDeboursNoteDto, userId: string) {
    // Vérifier que l'opportunité existe
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: dto.opportunityId },
      include: { company: true }
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    // Créer la note de débours
    const deboursNote = await this.prisma.deboursNote.create({
      data: {
        title: dto.title,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        expectedPaymentDate: dto.expectedPaymentDate ? new Date(dto.expectedPaymentDate) : null,
        totalAmount: dto.totalAmount.toString(),
        status: dto.status || 'DRAFT',
        opportunityId: dto.opportunityId,
        companyId: dto.companyId || opportunity.companyId,
        invoiceNumber: dto.invoiceNumber,
        notes: dto.notes,
        templateId: dto.templateId,
        expenses: dto.expenseIds ? {
          connect: dto.expenseIds.map(id => ({ id }))
        } : undefined
      },
      include: {
        opportunity: {
          include: { company: true }
        },
        company: true,
        expenses: true
      }
    });

    return deboursNote;
  }

  async findAll(filters?: { opportunityId?: string; companyId?: string }) {
    const where: any = {};
    
    if (filters?.opportunityId) {
      where.opportunityId = filters.opportunityId;
    }
    
    if (filters?.companyId) {
      where.companyId = filters.companyId;
    }

    return this.prisma.deboursNote.findMany({
      where,
      include: {
        opportunity: {
          include: { company: true }
        },
        company: true,
        expenses: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const deboursNote = await this.prisma.deboursNote.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: { company: true }
        },
        company: true,
        expenses: true,
        payments: true
      }
    });

    if (!deboursNote) {
      throw new NotFoundException('DeboursNote not found');
    }

    return deboursNote;
  }

  async update(id: string, dto: UpdateDeboursNoteDto) {
    const existing = await this.findOne(id);

    const updateData: any = {
      ...dto,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
      expectedPaymentDate: dto.expectedPaymentDate ? new Date(dto.expectedPaymentDate) : undefined,
      totalAmount: dto.totalAmount ? dto.totalAmount.toString() : undefined,
      invoiceNumber: dto.invoiceNumber !== undefined ? dto.invoiceNumber : undefined
    };

    // Gérer la mise à jour des expenses
    if (dto.expenseIds !== undefined) {
      // D'abord, déconnecter toutes les expenses existantes
      await this.prisma.deboursNote.update({
        where: { id },
        data: {
          expenses: {
            set: []
          }
        }
      });

      // Ensuite, connecter les nouvelles expenses
      if (dto.expenseIds.length > 0) {
        updateData.expenses = {
          connect: dto.expenseIds.map(expenseId => ({ id: expenseId }))
        };
      }
    }

    return this.prisma.deboursNote.update({
      where: { id },
      data: updateData,
      include: {
        opportunity: {
          include: { company: true }
        },
        company: true,
        expenses: true,
        payments: true
      }
    });
  }

  async delete(id: string) {
    await this.findOne(id); // Vérifier que la note existe
    await this.prisma.deboursNote.delete({ where: { id } });
    return { message: 'DeboursNote deleted successfully' };
  }

  async linkExpenses(deboursNoteId: string, expenseIds: string[]) {
    await this.findOne(deboursNoteId); // Vérifier que la note existe

    return this.prisma.deboursNote.update({
      where: { id: deboursNoteId },
      data: {
        expenses: {
          connect: expenseIds.map(id => ({ id }))
        }
      },
      include: {
        expenses: true
      }
    });
  }

  /**
   * Génère un document Google Docs depuis le template pour une note de débours
   */
  async generateFromGoogleDocs(deboursNoteId: string, userId: string, templateId?: string) {
    const deboursNote = await this.findOne(deboursNoteId);
    const opportunity = deboursNote.opportunity;
    const company = deboursNote.company || opportunity.company;

    // S'assurer que le dossier de l'opportunité existe
    let opportunityFolderId = opportunity.googleDriveFolderId;
    if (!opportunityFolderId) {
      const folder = await this.googleService.ensureOpportunityFolder(
        opportunity.company!,
        opportunity
      );
      opportunityFolderId = folder.id;
      
      // Mettre à jour l'opportunité avec le folderId
      await this.prisma.opportunity.update({
        where: { id: opportunity.id },
        data: { googleDriveFolderId: opportunityFolderId }
      });
    }

    // Préparer les données pour le template
    const replacements = this.mapDeboursNoteToTemplate(deboursNote, opportunity, company);

    // Utiliser le templateId fourni, celui stocké dans la note, ou le template par défaut
    const finalTemplateId = templateId || deboursNote.templateId || '1Zn5P7uqHnIj_-85-Qh6roVHe2WwCt8gBamEdZYMA7CA';

    // Créer le document
    const { id: googleDocId, url: googleDocUrl } = await this.googleDocs.createFromTemplate(
      finalTemplateId,
      replacements,
      opportunityFolderId,
      userId
    );

    // Mettre à jour la note de débours avec les infos du document
    return this.prisma.deboursNote.update({
      where: { id: deboursNoteId },
      data: {
        googleDocId,
        googleDocUrl
      },
      include: {
        opportunity: {
          include: { company: true }
        },
        company: true,
        expenses: true
      }
    });
  }

  /**
   * Mappe les données de la note de débours vers les placeholders du template
   */
  private mapDeboursNoteToTemplate(
    deboursNote: any,
    opportunity: any,
    company: any
  ): Record<string, string> {
    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatAmount = (amount: string | number | null | undefined): string => {
      if (!amount) return '0,00';
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return num.toFixed(2).replace('.', ',');
    };

    const replacements: Record<string, string> = {
      'Date du jour': formatDate(new Date()),
      'nom_client': company?.name || '',
      'adresse-client': company?.addressStreet || '',
      'code-postal': company?.addressZip || '',
      'Ville': company?.addressCity || '',
      'titre_note_debours': deboursNote.title,
      'date prestation': formatDate(opportunity.closeDate),
      'num_facture': (deboursNote.invoiceNumber && deboursNote.invoiceNumber.trim() !== '') ? deboursNote.invoiceNumber : (opportunity.tiimeInvoiceIds?.[0] || 'N/A'),
      'date_facture': formatDate(opportunity.closeDate),
      'montant_facture': formatAmount(opportunity.amount),
      'total_frais': formatAmount(deboursNote.totalAmount)
    };

    // Ajouter les frais individuels
    if (deboursNote.expenses && deboursNote.expenses.length > 0) {
      deboursNote.expenses.forEach((expense: any, index: number) => {
        const num = index + 1;
        replacements[`date_frais_${num}`] = formatDate(expense.invoiceDate);
        replacements[`intitulé_frais_${num}`] = expense.supplierName || expense.notes || 'Frais';
        replacements[`montant_frais_${num}`] = formatAmount(expense.amountTTC || expense.amountHT);
      });
    }

    return replacements;
  }
}

