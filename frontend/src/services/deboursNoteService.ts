import api from './apiClient';

export type DeboursNoteStatus = 'DRAFT' | 'SENT' | 'PAID';

export interface DeboursNote {
  id: string;
  title: string;
  issueDate: string;
  expectedPaymentDate?: string;
  totalAmount: number;
  status: DeboursNoteStatus;
  googleDocId?: string;
  googleDocUrl?: string;
  notes?: string;
  opportunityId: string;
  companyId?: string;
  expenses?: any[];
  payments?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeboursNoteDto {
  title: string;
  issueDate?: string;
  expectedPaymentDate?: string;
  totalAmount: number;
  status?: DeboursNoteStatus;
  opportunityId: string;
  companyId?: string;
  expenseIds?: string[];
  notes?: string;
  templateId?: string;
}

export interface UpdateDeboursNoteDto extends Partial<CreateDeboursNoteDto> {}

export const deboursNoteService = {
  async getAll(filters?: { opportunityId?: string; companyId?: string }): Promise<DeboursNote[]> {
    const params = new URLSearchParams();
    if (filters?.opportunityId) params.append('opportunityId', filters.opportunityId);
    if (filters?.companyId) params.append('companyId', filters.companyId);

    const { data } = await api.get<DeboursNote[]>(`/api/debours-notes?${params.toString()}`);
    return data;
  },

  async getById(id: string): Promise<DeboursNote> {
    const { data } = await api.get<DeboursNote>(`/api/debours-notes/${id}`);
    return data;
  },

  async create(dto: CreateDeboursNoteDto): Promise<DeboursNote> {
    const { data } = await api.post<DeboursNote>('/api/debours-notes', dto);
    return data;
  },

  async update(id: string, dto: UpdateDeboursNoteDto): Promise<DeboursNote> {
    const { data } = await api.patch<DeboursNote>(`/api/debours-notes/${id}`, dto);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/debours-notes/${id}`);
  },

  async linkExpenses(id: string, expenseIds: string[]): Promise<DeboursNote> {
    const { data } = await api.post<DeboursNote>(`/api/debours-notes/${id}/link-expenses`, { expenseIds });
    return data;
  },

  async generateDoc(id: string, templateId?: string): Promise<DeboursNote> {
    const { data } = await api.post<DeboursNote>(`/api/debours-notes/${id}/generate-doc`, { templateId });
    return data;
  }
};

