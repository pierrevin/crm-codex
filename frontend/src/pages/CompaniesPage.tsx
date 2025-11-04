import { useEffect, useState, useMemo } from 'react';
import { PlusIcon, MagnifyingGlassIcon, BuildingOfficeIcon, UserGroupIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">
            {companies.length > 0 && `${companies.length} client${companies.length > 1 ? 's' : ''} au total`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Nouveau client</span>
          <span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      {/* Champ de recherche */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un client par nom ou domaine..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Résultats */}
      {searchQuery && (
        <div className="text-sm text-slate-600 font-medium">
          {filteredCompanies.length} client{filteredCompanies.length > 1 ? 's' : ''} trouvé{filteredCompanies.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Grille de clients - Design Cards */}
      {filteredCompanies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((company) => (
            <Link
              key={company.id}
              to={`/clients/${company.id}`}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <BuildingOfficeIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                    <h3 className="text-base font-semibold text-slate-900 truncate">{company.name}</h3>
                  </div>
                  {company.domain && (
                    <p className="text-sm text-slate-500 truncate">{company.domain}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <UserGroupIcon className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {company._count?.contacts ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">contact{(company._count?.contacts ?? 0) > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BriefcaseIcon className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {company._count?.opportunities ?? 0}
                  </span>
                  <span className="text-xs text-slate-500">opportunité{(company._count?.opportunities ?? 0) > 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs font-medium text-indigo-600 group-hover:text-indigo-700">
                  Voir les détails →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : companies.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 mb-2">Aucun client ne correspond à votre recherche.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Effacer la recherche
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 mb-2">Aucun client pour le moment.</p>
          <p className="text-sm text-slate-400">Cliquez sur "Nouveau client" pour en ajouter un.</p>
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
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Nouveau client</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Domaine</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="exemple.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
