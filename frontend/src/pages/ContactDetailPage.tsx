import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TrashIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';

type ContactPayload = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyId?: string;
};

type ContactResponse = ContactPayload & { 
  id: string;
  company?: { id: string; name: string } | null;
};

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const [contact, setContact] = useState<ContactPayload>({ firstName: '' });
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    void loadCompanies();
    if (!isNew && id) {
      void loadContact(id);
    }
  }, [id, isNew]);

  const loadCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    }
  };

  const loadContact = async (contactId: string) => {
    setLoading(true);
    const { data } = await api.get<ContactResponse>(`/api/contacts/${contactId}`);
    setContact({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      companyId: data.company?.id
    });
    setLoading(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...contact,
      companyId: contact.companyId || null
    };
    if (isNew) {
      await api.post('/api/contacts', payload);
    } else if (id) {
      await api.patch(`/api/contacts/${id}`, payload);
    }
    navigate('/contacts');
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) {
      return;
    }
    try {
      await api.delete(`/api/contacts/${id}`);
      navigate('/contacts');
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
          {isNew ? 'Créer un contact' : 'Modifier le contact'}
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
          <label className="block text-sm font-medium text-slate-700">Prénom *</label>
          <input
            value={contact.firstName}
            onChange={(event) => setContact({ ...contact, firstName: event.target.value })}
            required
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nom</label>
          <input
            value={contact.lastName ?? ''}
            onChange={(event) => setContact({ ...contact, lastName: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={contact.email ?? ''}
            onChange={(event) => setContact({ ...contact, email: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Téléphone</label>
          <input
            value={contact.phone ?? ''}
            onChange={(event) => setContact({ ...contact, phone: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Entreprise</label>
          <CompanySearchSelect
            companies={companies}
            selectedCompanyId={contact.companyId}
            onSelectCompany={(companyId) => setContact({ ...contact, companyId })}
            onCreateCompany={async (name) => {
              const { data: newCompany } = await api.post('/api/companies', { name });
              setCompanies([...companies, newCompany]);
              setContact({ ...contact, companyId: newCompany.id });
            }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/contacts')}
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
