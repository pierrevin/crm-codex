import api from './apiClient';

export interface TaxRateConfig {
  id: string;
  rate: number; // 0.28 pour 28%
  label?: string;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxRateConfigDto {
  rate: number;
  label?: string;
  effectiveFrom: string; // ISO date string
}

export const taxService = {
  async getAll(): Promise<TaxRateConfig[]> {
    const { data } = await api.get<TaxRateConfig[]>('/api/tax-rates');
    return data;
  },

  async create(dto: CreateTaxRateConfigDto): Promise<TaxRateConfig> {
    const { data } = await api.post<TaxRateConfig>('/api/tax-rates', dto);
    return data;
  }
};

