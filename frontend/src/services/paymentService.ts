import api from './apiClient';

export interface Payment {
  id: string;
  opportunityId?: string;
  invoiceId?: string;
  deboursNoteId?: string;
  amount: number;
  paymentDate: string;
  taxRate: number;
  taxAmount: number;
  notes?: string;
  opportunity?: {
    id: string;
    title: string;
    company?: { id: string; name: string } | null;
    contact?: { id: string; firstName: string; lastName?: string } | null;
  };
  invoice?: {
    id: string;
    type: 'ACOMPTE' | 'FINAL';
    amountTTC: number;
    invoiceNumber?: string;
  };
  deboursNote?: {
    id: string;
    title: string;
    opportunity?: {
      id: string;
      title: string;
      company?: { id: string; name: string } | null;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentDto {
  opportunityId?: string;
  invoiceId?: string;
  deboursNoteId?: string;
  amount: number;
  paymentDate?: string;
  taxRate?: number;
  notes?: string;
}

export interface UpdatePaymentDto {
  amount?: number;
  paymentDate?: string;
  taxRate?: number;
  notes?: string;
}

export const paymentService = {
  async getAll(filters?: {
    opportunityId?: string;
    deboursNoteId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Payment[]> {
    const params = new URLSearchParams();
    if (filters?.opportunityId) params.append('opportunityId', filters.opportunityId);
    if (filters?.deboursNoteId) params.append('deboursNoteId', filters.deboursNoteId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    
    const { data } = await api.get<Payment[]>(`/api/payments?${params.toString()}`);
    return data;
  },

  async getById(id: string): Promise<Payment> {
    const { data } = await api.get<Payment>(`/api/payments/${id}`);
    return data;
  },

  async getByOpportunity(opportunityId: string): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>(`/api/payments/opportunity/${opportunityId}`);
    return data;
  },

  async getByDeboursNote(deboursNoteId: string): Promise<Payment[]> {
    const { data } = await api.get<Payment[]>(`/api/payments?deboursNoteId=${deboursNoteId}`);
    return data;
  },

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const { data } = await api.post<Payment>('/api/payments', dto);
    return data;
  },

  async update(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    const { data } = await api.patch<Payment>(`/api/payments/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/payments/${id}`);
  }
};

