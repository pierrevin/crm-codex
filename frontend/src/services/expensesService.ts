import api from './apiClient';
import axios from 'axios';

// Instance API séparée pour les expenses qui pointe vers le backend
// Sur mobile, utiliser l'IP du réseau local au lieu de localhost
const getBackendUrl = () => {
  // En production, utiliser l'URL de l'API
  if (import.meta.env.VITE_EXPENSES_API_URL) {
    return import.meta.env.VITE_EXPENSES_API_URL;
  }
  
  // En développement, détecter si on est sur mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // Sur mobile, localhost ne fonctionne pas, il faut l'IP du réseau local
    // L'utilisateur devra configurer VITE_EXPENSES_API_URL avec son IP locale
    // Exemple: http://192.168.1.100:3000
    console.warn('Sur mobile, configurez VITE_EXPENSES_API_URL avec l\'IP de votre machine (ex: http://192.168.1.100:3000)');
    // Essayer de détecter automatiquement depuis window.location si possible
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3000`;
    }
  }
  
  // Par défaut, localhost pour desktop
  return 'http://localhost:3000';
};

const expensesApi = axios.create({
  baseURL: getBackendUrl()
});

// Intercepteur pour ajouter le token JWT
expensesApi.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export type ExpenseStatus = 'PENDING' | 'PROCESSED' | 'VERIFIED' | 'REJECTED';

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
  company?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    email: string;
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
}

export const expensesService = {
  async scanExpense(file: File, accountCode?: string): Promise<Expense> {
    const formData = new FormData();
    formData.append('file', file);
    if (accountCode) {
      formData.append('accountCode', accountCode);
    }

    const { data } = await expensesApi.post<Expense>('/api/expenses/scan', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return data;
  },

  async getAll(filters?: ExpenseFilters): Promise<Expense[]> {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.companyId) params.append('companyId', filters.companyId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const { data } = await expensesApi.get<Expense[]>(`/api/expenses?${params.toString()}`);
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
  }
};

