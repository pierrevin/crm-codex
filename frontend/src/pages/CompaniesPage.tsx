import { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';

type Company = {
  id: string;
  name: string;
  domain?: string;
  _count?: {
    contacts: number;
    opportunities: number;
  };
};

type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
};

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    void loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      // L'API retourne directement un tableau, pas un objet paginé
      setCompanies(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      setCompanies([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">Gérez vos entreprises clientes.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Nouveau client
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <button
            key={company.id}
            onClick={() => window.location.href = `/companies/${company.id}`}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow text-left"
          >
            <h3 className="font-semibold text-slate-900">{company.name}</h3>
            {company.domain && (
              <p className="text-sm text-slate-500 mt-1">{company.domain}</p>
            )}
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span>{company._count?.contacts || 0} contacts</span>
              <span>{company._count?.opportunities || 0} opportunités</span>
            </div>
          </button>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>Aucun client pour le moment.</p>
          <p className="text-sm mt-2">Cliquez sur "Nouveau client" pour en ajouter un.</p>
        </div>
      )}

      {showModal && (
        <CreateCompanyModal
          onClose={() => setShowModal(false)}
          onCreated={loadCompanies}
        />
      )}
    </div>
  );
}

function CreateCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/companies', {
        name,
        domain: domain || undefined
      });
      onCreated();
      onClose();
    } catch (error) {
      console.error('Erreur création client:', error);
      alert('Erreur lors de la création');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Nouveau client</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Domaine</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="exemple.com"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

