import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRecurringExpenseDto, UpdateRecurringExpenseDto } from './dto';

@Injectable()
export class RecurringExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRecurringExpenseDto, userId: string) {
    return this.prisma.recurringExpense.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId?: string) {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    return this.prisma.recurringExpense.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.recurringExpense.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        expenses: {
          orderBy: {
            forecastDate: 'desc',
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateRecurringExpenseDto) {
    return this.prisma.recurringExpense.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    return this.prisma.recurringExpense.delete({
      where: { id },
    });
  }

  async generateForecastExpenses(
    recurringExpenseId: string,
    startDate: Date,
    endDate: Date
  ) {
    const recurringExpense = await this.prisma.recurringExpense.findUnique({
      where: { id: recurringExpenseId },
    });

    if (!recurringExpense || !recurringExpense.isActive) {
      throw new Error('Dépense récurrente non trouvée ou inactive');
    }

    const generatedExpenses = [];
    const currentDate = new Date(startDate);
    const finalEndDate = endDate || new Date();

    while (currentDate <= finalEndDate) {
      // Calculer la date de paiement pour ce mois
      const paymentDate = this.calculatePaymentDate(
        currentDate,
        recurringExpense.paymentDay,
        recurringExpense.recurrenceType
      );

      // Vérifier si une dépense prévisionnelle existe déjà pour cette date
      const existingExpense = await this.prisma.expense.findFirst({
        where: {
          recurringExpenseId,
          forecastDate: paymentDate,
          isForecast: true,
        },
      });

      if (!existingExpense && paymentDate <= finalEndDate) {
        // Vérifier que la date est dans la plage de validité
        if (
          paymentDate >= recurringExpense.startDate &&
          (!recurringExpense.endDate || paymentDate <= recurringExpense.endDate)
        ) {
          const expense = await this.prisma.expense.create({
            data: {
              supplierName: recurringExpense.supplierName,
              amountHT: recurringExpense.amountHT,
              amountTTC: recurringExpense.amountTTC,
              vatAmount: recurringExpense.vatAmount,
              vatRate: recurringExpense.vatRate,
              accountCode: recurringExpense.accountCode,
              accountLabel: recurringExpense.accountLabel,
              invoiceDate: paymentDate,
              forecastDate: paymentDate,
              isForecast: true,
              status: 'PENDING',
              recurringExpenseId: recurringExpense.id,
              companyId: recurringExpense.companyId,
              userId: recurringExpense.userId,
              opportunityId: recurringExpense.opportunityId,
              notes: recurringExpense.notes,
            },
          });
          generatedExpenses.push(expense);
        }
      }

      // Passer à la période suivante
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return generatedExpenses;
  }

  async validateForecastExpense(expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        recurringExpense: true,
      },
    });

    if (!expense) {
      throw new Error('Dépense non trouvée');
    }
    
    // Accepter la validation même si isForecast est false (pour les dépenses récurrentes déjà validées)
    // La vérification principale est que la dépense existe et peut être validée

    // Valider la dépense prévisionnelle : passer à VERIFIED mais garder isForecast si c'est une dépense récurrente
    // Le tag prévisionnel sera retiré uniquement quand la dépense sera marquée comme PAID
    const updateData: any = {
      status: 'VERIFIED',
    };
    
    // Si c'est une dépense récurrente, garder le tag prévisionnel jusqu'à ce qu'elle soit réglée
    if (expense.recurringExpenseId) {
      // IMPORTANT : Préserver explicitement le recurringExpenseId
      updateData.recurringExpenseId = expense.recurringExpenseId;
      updateData.isForecast = true;
      // Garder forecastDate si elle existe
      if (expense.forecastDate) {
        updateData.forecastDate = expense.forecastDate;
      }
    } else {
      // Si ce n'est pas une dépense récurrente, retirer le tag prévisionnel
      updateData.isForecast = false;
      updateData.forecastDate = null;
    }
    
    const updatedExpense = await this.prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
    });

    // Optionnellement, générer la prochaine dépense prévisionnelle
    if (expense.recurringExpense && expense.recurringExpense.isActive) {
      const nextPaymentDate = this.calculateNextPaymentDate(
        expense.forecastDate || expense.invoiceDate || new Date(),
        expense.recurringExpense.paymentDay,
        expense.recurringExpense.recurrenceType
      );

      // Vérifier si une dépense prévisionnelle existe déjà pour la prochaine date
      const existingNextExpense = await this.prisma.expense.findFirst({
        where: {
          recurringExpenseId: expense.recurringExpenseId,
          forecastDate: nextPaymentDate,
          isForecast: true,
        },
      });

      if (!existingNextExpense) {
        await this.prisma.expense.create({
          data: {
            supplierName: expense.recurringExpense.supplierName,
            amountHT: expense.recurringExpense.amountHT,
            amountTTC: expense.recurringExpense.amountTTC,
            vatAmount: expense.recurringExpense.vatAmount,
            vatRate: expense.recurringExpense.vatRate,
            accountCode: expense.recurringExpense.accountCode,
            accountLabel: expense.recurringExpense.accountLabel,
            invoiceDate: nextPaymentDate,
            forecastDate: nextPaymentDate,
            isForecast: true,
            status: 'PENDING',
            recurringExpenseId: expense.recurringExpenseId,
            companyId: expense.recurringExpense.companyId,
            userId: expense.recurringExpense.userId,
            opportunityId: expense.recurringExpense.opportunityId,
            notes: expense.recurringExpense.notes,
          },
        });
      }
    }

    return updatedExpense;
  }

  private calculatePaymentDate(
    baseDate: Date,
    paymentDay: number,
    recurrenceType: string
  ): Date {
    const date = new Date(baseDate);
    
    if (recurrenceType === 'MONTHLY') {
      // Définir le jour du mois (en gérant les mois avec moins de jours)
      const lastDayOfMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
      ).getDate();
      const day = Math.min(paymentDay, lastDayOfMonth);
      date.setDate(day);
    } else if (recurrenceType === 'QUARTERLY') {
      // Premier jour du trimestre + paymentDay
      const quarter = Math.floor(date.getMonth() / 3);
      date.setMonth(quarter * 3);
      const lastDayOfMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
      ).getDate();
      const day = Math.min(paymentDay, lastDayOfMonth);
      date.setDate(day);
    } else if (recurrenceType === 'YEARLY') {
      date.setMonth(0); // Janvier
      const lastDayOfMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
      ).getDate();
      const day = Math.min(paymentDay, lastDayOfMonth);
      date.setDate(day);
    } else if (recurrenceType === 'WEEKLY') {
      // Pour les récurrences hebdomadaires, paymentDay représente le jour de la semaine (0-6)
      const currentDay = date.getDay();
      const daysToAdd = (paymentDay - currentDay + 7) % 7;
      date.setDate(date.getDate() + daysToAdd);
    }

    return date;
  }

  private calculateNextPaymentDate(
    currentDate: Date,
    paymentDay: number,
    recurrenceType: string
  ): Date {
    const nextDate = new Date(currentDate);

    if (recurrenceType === 'MONTHLY') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (recurrenceType === 'QUARTERLY') {
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else if (recurrenceType === 'YEARLY') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else if (recurrenceType === 'WEEKLY') {
      nextDate.setDate(nextDate.getDate() + 7);
    }

    return this.calculatePaymentDate(nextDate, paymentDay, recurrenceType);
  }
}
