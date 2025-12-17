import api from './apiClient';

export type EffectiveSaleSource = 'OPPORTUNITY' | 'OFF_PIPE';
export type EffectiveSaleStatus = 'CONFIRMED' | 'INVOICED' | 'PAID';

export interface EffectiveSale {
  id: string;
  effectiveDate: string;
  label?: string | null;
  amount: string | number;
  currency: string;
  status: EffectiveSaleStatus;
  source: EffectiveSaleSource;
  opportunityId?: string | null;
  companyId?: string | null;
  externalRef?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  opportunity?: { id: string; title: string } | null;
  company?: { id: string; name: string } | null;
}

export interface CreateEffectiveSaleDto {
  effectiveDate?: string;
  label?: string | null;
  amount: number;
  currency?: string;
  status?: EffectiveSaleStatus;
  source?: EffectiveSaleSource;
  opportunityId?: string | null;
  companyId?: string | null;
  externalRef?: string | null;
}

export const effectiveSalesService = {
  async getAll(filters?: {
    opportunityId?: string;
    companyId?: string;
    startDate?: string;
    endDate?: string;
    source?: EffectiveSaleSource;
    status?: EffectiveSaleStatus;
    limit?: number;
  }): Promise<EffectiveSale[]> {
    const params = new URLSearchParams();
    if (filters?.opportunityId) params.append('opportunityId', filters.opportunityId);
    if (filters?.companyId) params.append('companyId', filters.companyId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.source) params.append('source', filters.source);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const query = params.toString();
    const { data } = await api.get<any>(`/api/effective-sales${query ? `?${query}` : ''}`);
    // Compat: l’API peut renvoyer soit un array, soit { items: [...] } en cas de warning
    const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    return items as EffectiveSale[];
  },

  async create(dto: CreateEffectiveSaleDto): Promise<EffectiveSale> {
    const { data } = await api.post<EffectiveSale>('/api/effective-sales', dto);
    return data;
  }
};

