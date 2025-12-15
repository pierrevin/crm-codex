import axios from 'axios';

// Utiliser l'API Supabase standard au lieu d'un backend séparé
import api from './apiClient';

const expensesApi = api;

// Les intercepteurs sont déjà gérés par apiClient

export type ExpenseStatus = 'PENDING' | 'PROCESSED' | 'VERIFIED' | 'PAID' | 'REJECTED';

export interface Expense {
  id: string;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  amountHT?: number;
  amountTTC?: number;
  vatAmount?: number;
  vatRate?: number;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  accountCode?: string;
  accountLabel?: string;
  status: ExpenseStatus;
  notes?: string;
  companyId?: string;
  userId?: string;
  opportunityId?: string;
  isForecast?: boolean;
  forecastDate?: string;
  recurringExpenseId?: string;
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
    company?: {
      id: string;
      name: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFilters {
  userId?: string;
  status?: ExpenseStatus;
  companyId?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateExpenseDto {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  amountHT?: number;
  amountTTC?: number;
  vatAmount?: number;
  vatRate?: number;
  accountCode?: string;
  accountLabel?: string;
  status?: ExpenseStatus;
  notes?: string;
  companyId?: string;
  opportunityId?: string;
  recurringExpenseId?: string;
  isForecast?: boolean;
  forecastDate?: string;
}

export const expensesService = {
  async scanExpense(file: File, accountCode?: string, opportunityId?: string): Promise<Expense> {
    const formData = new FormData();
    formData.append('file', file);
    if (accountCode) {
      formData.append('accountCode', accountCode);
    }
    if (opportunityId) {
      formData.append('opportunityId', opportunityId);
    }

    // Utiliser la fonction expenses dédiée pour le scan
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const accessToken = localStorage.getItem('accessToken');
    
    const scanUrl = `${SUPABASE_URL}/functions/v1/expenses/scan`;
    
    const headers: any = {
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey
    };
    
    if (accessToken) {
      headers['x-user-authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(scanUrl, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erreur lors du scan');
    }

    const data = await response.json();
    return data;
  },

  async getAll(filters?: ExpenseFilters & { opportunityId?: string }): Promise<Expense[]> {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.companyId) params.append('companyId', filters.companyId);
    if (filters?.opportunityId) params.append('opportunityId', filters.opportunityId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const { data } = await expensesApi.get<Expense[]>('/api/expenses', {
      params,
    });
    return data;
  },

  async getById(id: string): Promise<Expense> {
    const { data } = await expensesApi.get<Expense>(`/api/expenses/${id}`);
    return data;
  },

  async update(id: string, dto: UpdateExpenseDto): Promise<Expense> {
    const { data } = await expensesApi.put<Expense>(`/api/expenses/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await expensesApi.delete(`/api/expenses/${id}`);
  },

  async create(dto: CreateExpenseDto): Promise<Expense> {
    const { data } = await expensesApi.post<Expense>('/api/expenses', dto);
    return data;
  },

  async validateForecast(id: string): Promise<Expense> {
    const { data } = await expensesApi.post<Expense>(`/api/expenses/${id}/validate`);
    return data;
  }
};

export interface CreateExpenseDto {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  amountHT?: number;
  amountTTC?: number;
  vatAmount?: number;
  vatRate?: number;
  accountCode?: string;
  accountLabel?: string;
  status?: ExpenseStatus;
  notes?: string;
  companyId?: string;
  opportunityId?: string;
}

