import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TreasuryBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTaxImputationDate(paymentDate: Date): Date {
    const taxDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 2, 5);
    taxDate.setHours(0, 0, 0, 0);
    return taxDate;
  }

  private getRecognizedTaxes(payments: Array<{ paymentDate: Date; taxAmount: unknown }>, cutoffDate: Date): number {
    const cutoffKey = this.toDateKey(cutoffDate);
    return payments.reduce((sum, payment) => {
      const paymentDate = new Date(payment.paymentDate);
      if (isNaN(paymentDate.getTime())) return sum;
      const taxDate = this.getTaxImputationDate(paymentDate);
      const taxKey = this.toDateKey(taxDate);
      if (taxKey > cutoffKey) return sum;
      return sum + Number(payment.taxAmount ?? 0);
    }, 0);
  }

  async getCurrentBalance(): Promise<{ balance: number; isManual: boolean; date: Date }> {
    // Récupérer le dernier solde manuel
    const lastManualBalance = await this.prisma.treasuryBalance.findFirst({
      where: { isManual: true },
      orderBy: { date: 'desc' }
    });

    // Calculer le solde automatique à partir du dernier solde manuel
    let baseBalance = 0;
    let baseDate = new Date(0);

    if (lastManualBalance) {
      baseBalance = Number(lastManualBalance.balance);
      baseDate = lastManualBalance.date;
    }

    // Calculer les mouvements depuis le dernier solde manuel
    const now = new Date();

    // Somme des paiements réels depuis la date de base
    const payments = await this.prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: baseDate,
          lte: now
        }
      }
    });
    const totalPayments = payments.reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);

    // Somme des taxes reconnues à la date du calcul (imputation au 5 de M+2)
    const totalTaxes = this.getRecognizedTaxes(payments, now);

    // Somme des dépenses vérifiées depuis la date de base
    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'VERIFIED',
        invoiceDate: {
          gte: baseDate,
          lte: now
        }
      }
    });
    const totalExpenses = expenses.reduce(
      (sum: number, e: { amountTTC: unknown; amountHT: unknown }) => sum + Number(e.amountTTC || e.amountHT || 0),
      0
    );

    // Calcul du solde actuel
    const currentBalance = baseBalance + totalPayments - totalExpenses - totalTaxes;

    return {
      balance: currentBalance,
      isManual: false,
      date: now
    };
  }

  async setBalance(balance: number, date: Date, notes?: string) {
    // Vérifier s'il existe déjà un solde pour cette date
    const existing = await this.prisma.treasuryBalance.findUnique({
      where: { date }
    });

    if (existing) {
      return this.prisma.treasuryBalance.update({
        where: { date },
        data: {
          balance,
          isManual: true,
          notes
        }
      });
    }

    return this.prisma.treasuryBalance.create({
      data: {
        date,
        balance,
        isManual: true,
        notes
      }
    });
  }

  async getBalanceAtDate(date: Date): Promise<number | null> {
    // Chercher le solde manuel le plus récent avant ou à cette date
    const manualBalance = await this.prisma.treasuryBalance.findFirst({
      where: {
        isManual: true,
        date: { lte: date }
      },
      orderBy: { date: 'desc' }
    });

    if (!manualBalance) {
      return null;
    }

    const baseBalance = Number(manualBalance.balance);
    const baseDate = manualBalance.date;

    // Calculer les mouvements entre baseDate et date
    const payments = await this.prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: baseDate,
          lte: date
        }
      }
    });
    const totalPayments = payments.reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);
    const totalTaxes = this.getRecognizedTaxes(payments, date);

    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'VERIFIED',
        invoiceDate: {
          gte: baseDate,
          lte: date
        }
      }
    });
    const totalExpenses = expenses.reduce(
      (sum: number, e: { amountTTC: unknown; amountHT: unknown }) => sum + Number(e.amountTTC || e.amountHT || 0),
      0
    );

    return baseBalance + totalPayments - totalExpenses - totalTaxes;
  }

  async getAllBalances() {
    return this.prisma.treasuryBalance.findMany({
      orderBy: { date: 'desc' }
    });
  }
}

