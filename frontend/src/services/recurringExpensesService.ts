import api from './apiClient';

export type RecurrenceType = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface RecurringExpense {
  id: string;
  supplierName?: string;
  amountHT?: number;
  amountTTC?: number;
  vatAmount?: number;
  vatRate?: number;
  accountCode?: string;
  accountLabel?: string;
  recurrenceType: RecurrenceType;
  paymentDay: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  notes?: string;
  companyId?: string;
  userId?: string;
  opportunityId?: string;
  company?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    email: string;
  };
  opportunity?: {
    id: string;
    title: string;
  };
  expenses?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringExpenseDto {
  supplierName?: string;
  amountHT?: number;
  amountTTC?: number;
  vatAmount?: number;
  vatRate?: number;
  accountCode?: string;
  accountLabel?: string;
  recurrenceType?: RecurrenceType;
  paymentDay: number;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
  notes?: string;
  companyId?: string;
  opportunityId?: string;
}

export interface UpdateRecurringExpenseDto extends Partial<CreateRecurringExpenseDto> {}

export const recurringExpensesService = {
  async getAll(): Promise<RecurringExpense[]> {
    const { data } = await api.get<RecurringExpense[]>('/api/recurring-expenses');
    return data;
  },

  async getById(id: string): Promise<RecurringExpense> {
    const { data } = await api.get<RecurringExpense>(`/api/recurring-expenses/${id}`);
    return data;
  },

  async create(dto: CreateRecurringExpenseDto): Promise<RecurringExpense> {
    const { data } = await api.post<RecurringExpense>('/api/recurring-expenses', dto);
    return data;
  },

  async update(id: string, dto: UpdateRecurringExpenseDto): Promise<RecurringExpense> {
    const { data } = await api.put<RecurringExpense>(`/api/recurring-expenses/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/recurring-expenses/${id}`);
  },

  async generateForecast(id: string, startDate?: string, endDate?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const { data } = await api.post<any[]>(
      `/api/recurring-expenses/${id}/generate${params.toString() ? `?${params.toString()}` : ''}`
    );
    return data;
  },
};
