import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TrashIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';
import { ContactSearchSelect } from '../components/ContactSearchSelect';

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-100 text-blue-700' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-100 text-purple-700' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-100 text-green-700' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-100 text-rose-700' }
};

type OpportunityPayload = {
  title: string;
  stage: keyof typeof STAGES;
  amount?: number;
  closeDate?: string;
  contactId?: string;
  companyId?: string;
};

type OpportunityResponse = OpportunityPayload & { 
  id: string;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const [opportunity, setOpportunity] = useState<OpportunityPayload>({ 
    title: '', 
    stage: 'QUALIFICATION' 
  });
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    void loadContacts();
    void loadCompanies();
    if (!isNew && id) {
      void loadOpportunity(id);
    }
  }, [id, isNew]);

  const loadContacts = async () => {
    try {
      const { data } = await api.get('/api/contacts');
      setContacts(data.items || data.data || []);
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  const loadOpportunity = async (opportunityId: string) => {
    setLoading(true);
    const { data } = await api.get<OpportunityResponse>(`/api/opportunities/${opportunityId}`);
    setOpportunity({
      title: data.title,
      stage: data.stage,
      amount: data.amount,
      closeDate: data.closeDate,
      contactId: data.contact?.id,
      companyId: data.company?.id
    });
    setLoading(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...opportunity,
      amount: opportunity.amount || undefined,
      closeDate: opportunity.closeDate || undefined,
      contactId: opportunity.contactId || undefined,
      companyId: opportunity.companyId || undefined
    };
    if (isNew) {
      await api.post('/api/opportunities', payload);
    } else if (id) {
      await api.patch(`/api/opportunities/${id}`, payload);
    }
    navigate('/opportunites');
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette opportunité ?')) {
      return;
    }
    try {
      await api.delete(`/api/opportunities/${id}`);
      navigate('/opportunites');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Chargement...</div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          {isNew ? 'Créer une opportunité' : 'Modifier l\'opportunité'}
        </h1>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <TrashIcon className="h-4 w-4" />
            Supprimer
          </button>
        )}
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Titre *</label>
          <input
            value={opportunity.title}
            onChange={(event) => setOpportunity({ ...opportunity, title: event.target.value })}
            required
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Étape</label>
          <select
            value={opportunity.stage}
            onChange={(event) => setOpportunity({ ...opportunity, stage: event.target.value as keyof typeof STAGES })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {Object.entries(STAGES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Montant (€)</label>
          <input
            type="number"
            step="0.01"
            value={opportunity.amount ?? ''}
            onChange={(event) => setOpportunity({ ...opportunity, amount: event.target.value ? parseFloat(event.target.value) : undefined })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Date prévisionnelle de facturation</label>
          <input
            type="date"
            value={opportunity.closeDate ? opportunity.closeDate.split('T')[0] : ''}
            onChange={(event) => setOpportunity({ ...opportunity, closeDate: event.target.value || undefined })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Contact</label>
          <ContactSearchSelect
            contacts={contacts}
            selectedContactId={opportunity.contactId}
            defaultCompanyId={opportunity.companyId}
            defaultCompanyName={companies.find(c => c.id === opportunity.companyId)?.name}
            onSelectContact={(contactId) => setOpportunity({ ...opportunity, contactId })}
            onCreateContact={async (firstName, lastName, companyId) => {
              const { data: newContact } = await api.post('/api/contacts', { 
                firstName, 
                lastName: lastName || undefined,
                companyId: companyId || undefined
              });
              setContacts([...contacts, newContact]);
              setOpportunity({ ...opportunity, contactId: newContact.id });
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Client</label>
          <CompanySearchSelect
            companies={companies}
            selectedCompanyId={opportunity.companyId}
            onSelectCompany={(companyId) => setOpportunity({ ...opportunity, companyId })}
            onCreateCompany={async (name) => {
              const { data: newCompany } = await api.post('/api/companies', { name });
              setCompanies([...companies, newCompany]);
              setOpportunity({ ...opportunity, companyId: newCompany.id });
            }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/opportunites')}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

