import axios from 'axios';

// Instance API séparée pour les expenses qui pointe vers le backend
const getBackendUrl = () => {
  // 1. Variable d'environnement explicite (priorité)
  if (import.meta.env.VITE_EXPENSES_API_URL) {
    return import.meta.env.VITE_EXPENSES_API_URL;
  }

  if (import.meta.env.VITE_API_URL) {
    const base = import.meta.env.VITE_API_URL.replace(/\/$/, '');
    return `${base}/expenses`;
  }
  
  // 2. En production, construire l'URL depuis le hostname actuel
  const isProduction = import.meta.env.PROD || 
    (typeof window !== 'undefined' && 
     !window.location.hostname.includes('localhost') && 
     !window.location.hostname.includes('127.0.0.1'));
  
  if (isProduction && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    // Si le backend est sur le même domaine mais port 3000
    // Ou si c'est un sous-domaine/service séparé
    // Par défaut, essayer le même hostname avec port 3000
    return `${protocol}//${hostname}:3000`;
  }
  
  // 3. En développement, détecter si on est sur mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // Sur mobile, localhost ne fonctionne pas, il faut l'IP du réseau local
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3000`;
    }
    console.warn('Sur mobile en développement, configurez VITE_EXPENSES_API_URL avec l\'IP de votre machine (ex: http://192.168.1.100:3000)');
  }
  
  // 4. Par défaut, localhost pour desktop en développement
  return 'http://localhost:3000';
};

const expensesApi = axios.create({
  baseURL: getBackendUrl()
});

// Intercepteur pour ajouter les bons headers d'authentification
expensesApi.interceptors.request.use((config) => {
  const SUPABASE_EDGE_BASE = '.supabase.co/functions/v1';
  const isSupabaseEdge = (url?: string) =>
    typeof url === 'string' && url.includes(SUPABASE_EDGE_BASE);

  const accessToken = localStorage.getItem('accessToken');
  const anonKeyFromEnv = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const ANON_KEY_FALLBACK =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lY2JydHllcWF0aWVleWJqdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTUyMDIsImV4cCI6MjA3NTQ5MTIwMn0.Z4u7oicInUcPjT19p71NRyu6ck63HSXHByH8uL5-IvY';
  const anonKey = anonKeyFromEnv || ANON_KEY_FALLBACK;

  config.headers = config.headers || {};
  const targetBaseUrl = config.baseURL || expensesApi.defaults.baseURL;

  if (isSupabaseEdge(targetBaseUrl)) {
    config.headers.Authorization = `Bearer ${anonKey}`;
    (config.headers as any).apikey = anonKey;

    if (!anonKeyFromEnv) {
      console.warn('VITE_SUPABASE_ANON_KEY non définie, utilisation du fallback. Configurez-la en production.');
    }

    if (accessToken) {
      (config.headers as any)['x-user-authorization'] = `Bearer ${accessToken}`;
    }
  } else if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs réseau
expensesApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      console.error('Erreur réseau expenses API:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        message: error.message
      });
    }
    return Promise.reject(error);
  }
);

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

