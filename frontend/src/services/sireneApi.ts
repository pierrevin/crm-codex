import api from './apiClient';

export interface SireneSearchParams {
  type: 'siret' | 'siren' | 'name';
  value: string;
  postalCode?: string;
  city?: string;
}

export interface SireneResult {
  siret: string;
  siren: string;
  denomination: string;
  codeNAF?: string;
  libelleNAF?: string;
  addressStreet?: string;
  addressZip?: string;
  addressCity?: string;
  addressCountry?: string;
  isIndividual?: boolean;
}

export interface SireneSearchResponse {
  results: SireneResult[];
}

/**
 * Recherche d'entreprise via l'API Sirene
 */
export async function searchSirene(params: SireneSearchParams): Promise<SireneSearchResponse> {
  const response = await api.post<SireneSearchResponse>('/api/companies/sirene/search', params);
  return response.data;
}

/**
 * Complète une fiche entreprise existante avec les données Sirene
 */
export async function fillCompanyFromSirene(
  companyId: string,
  params: { siret?: string; siren?: string; name?: string }
): Promise<any> {
  const response = await api.post(`/api/companies/${companyId}/sirene/fill`, params);
  return response.data;
}

