import { useEffect, useState, useMemo } from 'react';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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
  data?: T[];
  items?: T[];
  nextCursor?: string | null;
  total?: number;
};

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      // L'API retourne directement un tableau, pas un objet paginé
      setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      setCompanies([]);
    }
  };

  // Filtrer les clients en fonction de la recherche
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    
    const query = searchQuery.toLowerCase();
    return companies.filter(company => 
      company.name.toLowerCase().includes(query) ||
      company.domain?.toLowerCase().includes(query)
    );
  }, [companies, searchQuery]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">Gérez vos clients partenaires.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Nouveau client</span>
          <span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      {/* Champ de recherche */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un client par nom ou domaine..."
          className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Résultats */}
      {searchQuery && (
        <div className="text-sm text-slate-600">
          {filteredCompanies.length} client{filteredCompanies.length > 1 ? 's' : ''} trouvé{filteredCompanies.length > 1 ? 's' : ''}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCompanies.map((company) => (
          <button
            key={company.id}
            onClick={() => window.location.href = `/clients/${company.id}`}
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

      {filteredCompanies.length === 0 && companies.length > 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>Aucun client ne correspond à votre recherche.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-sm text-indigo-600 hover:text-indigo-500 mt-2"
          >
            Effacer la recherche
          </button>
        </div>
      )}

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

