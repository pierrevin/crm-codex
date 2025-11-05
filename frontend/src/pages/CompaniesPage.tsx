import { useEffect, useState, useMemo } from 'react';
import { PlusIcon, MagnifyingGlassIcon, BuildingOfficeIcon, UserGroupIcon, BriefcaseIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';

import api from '../services/apiClient';
import { recentStorage } from '../services/localStorage';

type Company = {
  id: string;
  name: string;
  domain?: string;
  _count?: {
    contacts: number;
    opportunities: number;
  };
};

type SortOption = 'recent' | 'name-asc' | 'name-desc';

export function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [recentCompanies, setRecentCompanies] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void loadCompanies();
    // Charger les récents
    const recent = recentStorage.getCompanies();
    setRecentCompanies(recent.map(item => ({ id: item.id, name: item.name })));
  }, []);

  const loadCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
      setCompanies([]);
    }
  };

  // Filtrer et trier les entreprises
  const filteredAndSortedCompanies = useMemo(() => {
    let filtered = companies;
    
    // Filtrer par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = companies.filter(company => 
        company.name.toLowerCase().includes(query) ||
        company.domain?.toLowerCase().includes(query)
      );
    }
    
    // Trier
    const sorted = [...filtered];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'recent':
      default:
        // Trier par createdAt (dernière modification) - déjà trié par l'API
        break;
    }
    
    return sorted;
  }, [companies, searchQuery, sortBy]);

  // Récupérer les détails des récents depuis la liste complète
  const recentCompaniesDetails = useMemo(() => {
    return recentCompanies
      .map(recent => companies.find(c => c.id === recent.id))
      .filter(Boolean) as Company[];
  }, [recentCompanies, companies]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Entreprises</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {companies.length > 0 && `${companies.length} entreprise${companies.length > 1 ? 's' : ''} au total`}
                </p>
        </div>
        <button
          onClick={() => navigate('/entreprises/new')}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Nouvelle entreprise</span>
          <span className="sm:hidden">Nouvelle</span>
        </button>
      </div>

      {/* Champ de recherche */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une entreprise par nom ou domaine..."
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

      {/* Section Récents */}
      {recentCompaniesDetails.length > 0 && !searchQuery && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Récents</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentCompaniesDetails.map((company) => (
              <Link
                key={company.id}
                to={`/entreprises/${company.id}`}
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
        </div>
      )}

      {/* Sélecteur de tri et résultats */}
      <div className="flex items-center justify-between gap-4">
                 {searchQuery && (
                 <div className="text-sm text-slate-600 font-medium">
                   {filteredAndSortedCompanies.length} entreprise{filteredAndSortedCompanies.length > 1 ? 's' : ''} trouvée{filteredAndSortedCompanies.length > 1 ? 's' : ''}
                 </div>
               )}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-slate-600">Trier par:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="recent">Dernière modification</option>
            <option value="name-asc">Nom A-Z</option>
            <option value="name-desc">Nom Z-A</option>
          </select>
        </div>
      </div>

      {/* Grille d'entreprises - Design Cards */}
      {filteredAndSortedCompanies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCompanies.map((company) => (
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
      ) : filteredAndSortedCompanies.length === 0 && companies.length > 0 ? (
               <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
                 <p className="text-slate-500 mb-2">Aucune entreprise ne correspond à votre recherche.</p>
                 <button
                   onClick={() => setSearchQuery('')}
                   className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                 >
                   Effacer la recherche
                 </button>
               </div>
             ) : (
               <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
                 <p className="text-slate-500 mb-2">Aucune entreprise pour le moment.</p>
                 <p className="text-sm text-slate-400">Cliquez sur "Nouvelle entreprise" pour en ajouter une.</p>
               </div>
      )}

    </div>
  );
}
