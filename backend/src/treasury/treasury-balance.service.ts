import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TreasuryBalanceService {
  constructor(private readonly prisma: PrismaService) {}

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
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Somme des taxes payées (calculées à partir des paiements)
    const totalTaxes = payments.reduce((sum, p) => sum + Number(p.taxAmount), 0);

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
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amountTTC || e.amountHT || 0), 0);

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

    let baseBalance = Number(manualBalance.balance);
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
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalTaxes = payments.reduce((sum, p) => sum + Number(p.taxAmount), 0);

    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'VERIFIED',
        invoiceDate: {
          gte: baseDate,
          lte: date
        }
      }
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amountTTC || e.amountHT || 0), 0);

    return baseBalance + totalPayments - totalExpenses - totalTaxes;
  }

  async getAllBalances() {
    return this.prisma.treasuryBalance.findMany({
      orderBy: { date: 'desc' }
    });
  }
}

