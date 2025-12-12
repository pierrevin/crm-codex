import api from './apiClient';

export interface TreasuryBalance {
  balance: number;
  isManual: boolean;
  date: string;
  notes?: string | null;
}

export interface TreasuryForecast {
  opportunities: Array<{
    id: string;
    title: string;
    amount: number | null;
    expectedPaymentDate: string;
    taxRate: number | null;
    stage?: string;
  }>;
  payments: Array<{
    amount: number;
    taxAmount: number;
    paymentDate: string;
    opportunityId?: string;
  }>;
  expenses: Array<{
    amountTTC: number | null;
    amountHT: number | null;
    invoiceDate: string | null;
    opportunityId?: string;
  }>;
  deboursNotes?: Array<{
    id: string;
    totalAmount: number;
    issueDate: string;
    expectedPaymentDate: string | null;
    opportunityId: string;
  }>;
  deboursNotesForecast?: Array<{
    id: string;
    totalAmount: number;
    issueDate: string;
    expectedPaymentDate: string;
    opportunityId: string;
    totalFrais: number; // Montant calculé depuis les dépenses (frais uniquement)
  }>;
  finalizedExpenses?: Array<{
    amountTTC: number | null;
    amountHT: number | null;
    invoiceDate: string | null;
    opportunityId: string;
  }>;
  finalizedDeboursNotes?: Array<{
    id: string;
    totalAmount: number;
    issueDate: string;
    expectedPaymentDate: string | null;
    opportunityId: string;
  }>;
  taxPayments: Record<string, number>;
}

export interface SetBalanceDto {
  balance: number;
  date?: string;
  notes?: string;
}

export const treasuryService = {
  async getBalance(): Promise<TreasuryBalance> {
    const { data } = await api.get<TreasuryBalance>('/api/treasury/balance');
    return data;
  },

  async setBalance(dto: SetBalanceDto): Promise<TreasuryBalance> {
    const { data } = await api.post<TreasuryBalance>('/api/treasury/balance', dto);
    return data;
  },

  async getForecast(startDate?: string, endDate?: string): Promise<TreasuryForecast> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const { data } = await api.get<TreasuryForecast>(`/api/treasury/forecast?${params.toString()}`);
    return data;
  }
};

