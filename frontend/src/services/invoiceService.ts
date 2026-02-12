import api from './apiClient';

export type InvoiceType = 'ACOMPTE' | 'FINAL';

export interface Invoice {
  id: string;
  type: InvoiceType;
  amountTTC: number;
  taxRate: number;
  invoiceUrl?: string;
  invoiceNumber?: string;
  opportunityId: string;
  issueDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  payments?: Array<{
    id: string;
    amount: number;
    paymentDate: string;
  }>;
  opportunity?: {
    id: string;
    title: string;
    company?: {
      id: string;
      name: string;
    };
    contact?: {
      id: string;
      firstName: string;
      lastName?: string;
    };
  };
}

export interface CreateInvoiceDto {
  type: InvoiceType;
  amountTTC: number;
  taxRate?: number;
  invoiceUrl?: string;
  invoiceNumber?: string;
  opportunityId: string;
  issueDate?: string;
  notes?: string;
}

export interface UpdateInvoiceDto {
  type?: InvoiceType;
  amountTTC?: number;
  taxRate?: number;
  invoiceUrl?: string;
  invoiceNumber?: string;
  issueDate?: string;
  notes?: string;
}


export const invoiceService = {
  async getAll(filters?: { opportunityId?: string }): Promise<Invoice[]> {
    const params: any = {};
    if (filters?.opportunityId) {
      params.opportunityId = filters.opportunityId;
    }
    const response = await api.get('/api/invoices', { params });
    return response.data;
  },

  async getByOpportunity(opportunityId: string): Promise<Invoice[]> {
    const response = await api.get(`/api/invoices/opportunity/${opportunityId}`);
    return response.data;
  },

  async getById(id: string): Promise<Invoice> {
    const response = await api.get(`/api/invoices/${id}`);
    return response.data;
  },

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    const response = await api.post('/api/invoices', dto);
    return response.data;
  },

  async update(id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const response = await api.patch(`/api/invoices/${id}`, dto);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/invoices/${id}`);
  }
};
