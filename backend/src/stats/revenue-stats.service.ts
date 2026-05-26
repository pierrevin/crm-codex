import { Injectable } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';
import { TaxRateService } from '../tax/tax-rate.service';

export type RevenueStatsParams = {
  dateFrom?: string;
  dateTo?: string;
  ownerId?: string;
  companyId?: string;
};

type RevenueByMonth = {
  month: string;
  signed: number;
  invoiced: number;
  paid: number;
};

@Injectable()
export class RevenueStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxRates: TaxRateService
  ) {}

  private async getAverageTaxRate(dateFrom?: Date, dateTo?: Date): Promise<number> {
    if (!dateFrom || !dateTo) {
      return this.taxRates.getRateForDate(new Date());
    }

    const configs = await this.taxRates.listAll();

    if (!configs || configs.length === 0) {
      return 0.28;
    }

    const sorted = [...configs].sort(
      (a: any, b: any) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
    );

    const periodStart = dateFrom;
    const periodEnd = dateTo;
    const totalMs = periodEnd.getTime() - periodStart.getTime();

    if (totalMs <= 0) {
      return Number(sorted[sorted.length - 1].rate);
    }

    let weightedSum = 0;
    let coveredMs = 0;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      const segmentStart = current.effectiveFrom;
      const segmentEnd = next ? next.effectiveFrom : periodEnd;

      const clampedStart = segmentStart < periodStart ? periodStart : segmentStart;
      const clampedEnd = segmentEnd > periodEnd ? periodEnd : segmentEnd;

      if (clampedEnd <= clampedStart) continue;

      const duration = clampedEnd.getTime() - clampedStart.getTime();
      const rate = Number(current.rate);

      weightedSum += rate * duration;
      coveredMs += duration;
    }

    if (coveredMs === 0) {
      return this.taxRates.getRateForDate(periodEnd);
    }

    return weightedSum / coveredMs;
  }

  async getRevenueStats(params: RevenueStatsParams) {
    const { dateFrom, dateTo, ownerId, companyId } = params;

    const fromDate = dateFrom ? new Date(dateFrom) : undefined;
    const toDate = dateTo ? new Date(dateTo) : undefined;

    const effectiveSaleWhere: any = {};
    const invoiceWhere: any = {};
    const paymentWhere: any = {};

    if (fromDate || toDate) {
      effectiveSaleWhere.effectiveDate = {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate })
      };
      invoiceWhere.issueDate = {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate })
      };
      paymentWhere.paymentDate = {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate })
      };
    }

    if (companyId) {
      effectiveSaleWhere.companyId = companyId;
      invoiceWhere.opportunity = { companyId };
      paymentWhere.invoice = { opportunity: { companyId } };
    }

    if (ownerId) {
      effectiveSaleWhere.createdById = ownerId;
      invoiceWhere.opportunity = { ...(invoiceWhere.opportunity || {}), ownerId };
      paymentWhere.invoice = {
        ...(paymentWhere.invoice || {}),
        opportunity: { ...(paymentWhere.invoice?.opportunity || {}), ownerId }
      };
    }

    const [effectiveSales, invoices, payments, averageTaxRate] = await Promise.all([
      this.prisma.effectiveSale.findMany({
        where: effectiveSaleWhere
      }),
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          opportunity: {
            select: {
              companyId: true
            }
          }
        }
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        include: {
          invoice: {
            select: {
              opportunity: {
                select: {
                  companyId: true
                }
              }
            }
          }
        }
      }),
      this.getAverageTaxRate(fromDate, toDate)
    ]);

    let signedGross = 0;
    let invoicedGross = 0;
    let paidGross = 0;

    const revenueByMonthMap = new Map<string, RevenueByMonth>();
    const topCustomersMap = new Map<
      string,
      { companyId: string; revenue: number }
    >();

    const addToMonth = (monthKey: string, field: keyof RevenueByMonth, amount: number) => {
      if (!revenueByMonthMap.has(monthKey)) {
        revenueByMonthMap.set(monthKey, {
          month: monthKey,
          signed: 0,
          invoiced: 0,
          paid: 0
        });
      }
      const current = revenueByMonthMap.get(monthKey)!;
      current[field] += amount;
    };

    const addToTopCustomers = (companyId: string | null | undefined, amount: number) => {
      if (!companyId || amount <= 0) return;
      const current = topCustomersMap.get(companyId) || {
        companyId,
        revenue: 0
      };
      current.revenue += amount;
      topCustomersMap.set(companyId, current);
    };

    // CA signé (EffectiveSale)
    for (const sale of effectiveSales) {
      const amount = Number(sale.amount) || 0;
      signedGross += amount;

      const d = sale.effectiveDate;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      addToMonth(monthKey, 'signed', amount);

      addToTopCustomers(sale.companyId, amount);
    }

    // CA facturé (Invoice)
    for (const invoice of invoices) {
      const amount = Number(invoice.amountTTC) || 0;
      invoicedGross += amount;

      const d = invoice.issueDate;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      addToMonth(monthKey, 'invoiced', amount);

      addToTopCustomers(invoice.opportunity?.companyId, amount);
    }

    // CA encaissé (Payment)
    for (const payment of payments) {
      const amount = Number(payment.amount) || 0;
      paidGross += amount;

      const d = payment.paymentDate;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      addToMonth(monthKey, 'paid', amount);

      addToTopCustomers(payment.invoice?.opportunity?.companyId, amount);
    }

    const signedNet = signedGross * (1 - averageTaxRate);
    const invoicedNet = invoicedGross * (1 - averageTaxRate);
    const paidNet = paidGross * (1 - averageTaxRate);

    const revenueByMonth = Array.from(revenueByMonthMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    const topCustomers = Array.from(topCustomersMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      averageTaxRate,
      signed: {
        gross: signedGross,
        net: signedNet
      },
      invoiced: {
        gross: invoicedGross,
        net: invoicedNet
      },
      paid: {
        gross: paidGross,
        net: paidNet
      },
      revenueByMonth,
      topCustomers
    };
  }
}

