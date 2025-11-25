import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DocumentAiService } from './ocr/document-ai.service';
import { ExpenseParserService } from './ocr/expense-parser.service';
import { SupabaseStorageService } from './storage/supabase-storage.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private documentAi: DocumentAiService,
    private expenseParser: ExpenseParserService,
    private storage: SupabaseStorageService
  ) {}

  async scanAndCreateExpense(
    file: { fieldname: string; originalname: string; mimetype: string; buffer: Buffer; size: number },
    userId: string,
    accountCode?: string
  ) {
    let parsedData: any = {};
    let document: any = null;

    // 1. Essayer de traiter le document avec Document AI
    try {
      document = await this.documentAi.processDocument(
        file.buffer,
        file.mimetype
      );

      // 2. Extraire les données structurées
      parsedData = await this.expenseParser.parseExpenseData(document);
    } catch (error: any) {
      // Si Document AI échoue (permissions, etc.), créer quand même la dépense
      // L'utilisateur pourra remplir les informations manuellement
      console.error('Erreur Document AI, création de la dépense sans OCR:', error.message);
      parsedData = {
        accountCode: accountCode || '606', // Compte par défaut
        accountLabel: 'Achats non stockés'
      };
    }

    // 3. Uploader le fichier vers Supabase Storage
    const fileUrl = await this.storage.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId
    );

    // 4. Créer l'expense en base
    const expense = await this.prisma.expense.create({
      data: {
        supplierName: parsedData.supplierName,
        invoiceNumber: parsedData.invoiceNumber,
        invoiceDate: parsedData.invoiceDate,
        amountHT: parsedData.amountHT ? parsedData.amountHT.toString() : null,
        amountTTC: parsedData.amountTTC ? parsedData.amountTTC.toString() : null,
        vatAmount: parsedData.vatAmount ? parsedData.vatAmount.toString() : null,
        vatRate: parsedData.vatRate ? parsedData.vatRate.toString() : null,
        fileUrl,
        fileName: file.originalname,
        fileType: file.mimetype,
        rawOcrData: document as any,
        accountCode: accountCode || parsedData.accountCode,
        accountLabel: parsedData.accountLabel,
        companyId: parsedData.companyId,
        userId,
        status: 'PENDING', // À valider manuellement
        notes: document ? null : 'OCR non disponible - Informations à remplir manuellement'
      },
      include: {
        company: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return expense;
  }

  async findAll(userId?: string, filters?: {
    status?: string;
    companyId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.companyId) {
      where.companyId = filters.companyId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) {
        where.invoiceDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.invoiceDate.lte = filters.endDate;
      }
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        company: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    return this.prisma.expense.findUnique({
      where: { id },
      include: {
        company: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const updateData: any = { ...dto };

    // Convertir les montants en Decimal si présents
    if (dto.amountHT !== undefined) {
      updateData.amountHT = dto.amountHT?.toString() || null;
    }
    if (dto.amountTTC !== undefined) {
      updateData.amountTTC = dto.amountTTC?.toString() || null;
    }
    if (dto.vatAmount !== undefined) {
      updateData.vatAmount = dto.vatAmount?.toString() || null;
    }
    if (dto.vatRate !== undefined) {
      updateData.vatRate = dto.vatRate?.toString() || null;
    }

    // Convertir la date si présente
    if (dto.invoiceDate) {
      updateData.invoiceDate = new Date(dto.invoiceDate);
    }

    return this.prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        company: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
  }

  async delete(id: string) {
    // Récupérer l'expense pour supprimer le fichier
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      select: { fileUrl: true }
    });

    if (expense?.fileUrl) {
      try {
        await this.storage.deleteFile(expense.fileUrl);
      } catch (error) {
        // Log l'erreur mais continue la suppression
        console.error('Error deleting file from storage:', error);
      }
    }

    return this.prisma.expense.delete({ where: { id } });
  }
}

