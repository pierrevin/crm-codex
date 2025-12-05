import { useEffect, useState, useMemo } from 'react';
import { PlusIcon, MagnifyingGlassIcon, BuildingOfficeIcon, UserGroupIcon, BriefcaseIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';

import api from '../services/apiClient';
import { recentStorage } from '../services/localStorage';

type Company = {
  id: string;
  name: string;
  domain?: string;
  statusSupplier?: boolean;
  statusClient?: boolean;
  statusProspect?: boolean;
  lastInvoiceDate?: string;
  lastActivityAt?: string;
  opportunities?: Array<{
    id: string;
    stage: string;
    closeDate?: string;
    createdAt: string;
  }>;
  _count?: {
    contacts: number;
    opportunities: number;
  };
};

type SortOption = 'recent' | 'name-asc' | 'name-desc';
type SupplierFilter = 'yes' | 'no';
type ProspectFilter = 'yes' | 'no' | 'both';
type ClientFilter = {
  active: boolean; // En cours ou moins de 1 an
  '1year': boolean; // Moins de 2 ans
  '2years': boolean; // Moins de 3 ans
  '3years': boolean; // Plus de 3 ans
};

export function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('no');
  const [prospectFilter, setProspectFilter] = useState<ProspectFilter>('both');
  const [clientFilter, setClientFilter] = useState<ClientFilter>({
    active: true, // Moins de 1 an par défaut
    '1year': false,
    '2years': false,
    '3years': false
  });
  const [recentCompanies, setRecentCompanies] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void loadCompanies();
    // Charger les récents
    const recent = recentStorage.getCompanies();
    setRecentCompanies(recent.map(item => ({ id: item.id, name: item.name })));
  }, []);

  const loadCompanies = async () => {
    try {
      // Charger les entreprises avec leurs opportunités
      const { data } = await api.get('/api/companies');
      const companiesList = Array.isArray(data) ? data : (data.items || data.data || []);
      
      // Charger les opportunités pour chaque entreprise
      const companiesWithOpportunities = await Promise.all(
        companiesList.map(async (company: any) => {
          try {
            const { data: oppsData } = await api.get(`/api/opportunities?companyId=${company.id}`);
            const opportunities = Array.isArray(oppsData) ? oppsData : (oppsData.items || oppsData.data || []);
            return {
              ...company,
              opportunities: opportunities.map((opp: any) => ({
                id: opp.id,
                stage: opp.stage,
                closeDate: opp.closeDate,
                createdAt: opp.createdAt
              }))
            };
          } catch (error) {
            console.error(`Erreur chargement opportunités pour ${company.id}:`, error);
            return { ...company, opportunities: [] };
          }
        })
      );
      
      setCompanies(companiesWithOpportunities);
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
    
    // Filtrer par fournisseur
    if (supplierFilter === 'yes') {
      filtered = filtered.filter((company: any) => company.statusSupplier === true);
    } else if (supplierFilter === 'no') {
      filtered = filtered.filter((company: any) => !company.statusSupplier);
    }
    
    // Filtrer par prospect (opportunités en qualification ou proposition)
    if (prospectFilter !== 'both') {
      filtered = filtered.filter((company: any) => {
        const hasProspectOpps = company.opportunities?.some((opp: any) => 
          opp.stage === 'QUALIFICATION' || opp.stage === 'PROPOSAL'
        ) || false;
        
        if (prospectFilter === 'yes') {
          return hasProspectOpps;
        } else {
          return !hasProspectOpps;
        }
      });
    }
    
    // Filtrer par client (basé sur les opportunités)
    const hasClientFilter = Object.values(clientFilter).some(v => v === true);
    if (hasClientFilter) {
      const now = new Date();
      filtered = filtered.filter((company: any) => {
        // Vérifier si l'entreprise a des opportunités client (pas en qualification/proposition)
        const clientOpportunities = company.opportunities?.filter((opp: any) => 
          opp.stage !== 'QUALIFICATION' && opp.stage !== 'PROPOSAL' && opp.stage !== 'CLOSED_LOST'
        ) || [];
        
        if (clientOpportunities.length === 0) return false;
        
        // Vérifier les périodes selon les cases cochées
        const matches: boolean[] = [];
        
        if (clientFilter.active) {
          // En cours ou moins de 1 an
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const hasRecent = clientOpportunities.some((opp: any) => {
            const oppDate = opp.closeDate ? new Date(opp.closeDate) : new Date(opp.createdAt);
            return oppDate >= oneYearAgo || !opp.closeDate; // En cours si pas de closeDate
          });
          matches.push(hasRecent);
        }
        
        if (clientFilter['1year']) {
          // Moins de 2 ans
          const twoYearsAgo = new Date(now);
          twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const has1Year = clientOpportunities.some((opp: any) => {
            const oppDate = opp.closeDate ? new Date(opp.closeDate) : new Date(opp.createdAt);
            return oppDate >= twoYearsAgo && oppDate < oneYearAgo;
          });
          matches.push(has1Year);
        }
        
        if (clientFilter['2years']) {
          // Moins de 3 ans
          const threeYearsAgo = new Date(now);
          threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
          const twoYearsAgo = new Date(now);
          twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
          const has2Years = clientOpportunities.some((opp: any) => {
            const oppDate = opp.closeDate ? new Date(opp.closeDate) : new Date(opp.createdAt);
            return oppDate >= threeYearsAgo && oppDate < twoYearsAgo;
          });
          matches.push(has2Years);
        }
        
        if (clientFilter['3years']) {
          // Plus de 3 ans
          const threeYearsAgo = new Date(now);
          threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
          const has3Years = clientOpportunities.some((opp: any) => {
            const oppDate = opp.closeDate ? new Date(opp.closeDate) : new Date(opp.createdAt);
            return oppDate < threeYearsAgo;
          });
          matches.push(has3Years);
        }
        
        // Retourner true si au moins une case cochée correspond
        return matches.some(m => m === true);
      });
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
  }, [companies, searchQuery, sortBy, supplierFilter, prospectFilter, clientFilter]);

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

      {/* Filtres et tri */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {searchQuery && (
              <div className="text-sm text-slate-600 font-medium">
                {filteredAndSortedCompanies.length} entreprise{filteredAndSortedCompanies.length > 1 ? 's' : ''} trouvée{filteredAndSortedCompanies.length > 1 ? 's' : ''}
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Fournisseur:</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value as SupplierFilter)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="no">Non</option>
                <option value="yes">Oui</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Prospect:</label>
              <select
                value={prospectFilter}
                onChange={(e) => setProspectFilter(e.target.value as ProspectFilter)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="both">Les deux</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Client:</label>
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientFilter.active}
                    onChange={(e) => setClientFilter({ ...clientFilter, active: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>En cours / &lt;1 an</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientFilter['1year']}
                    onChange={(e) => setClientFilter({ ...clientFilter, '1year': e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>&lt;2 ans</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientFilter['2years']}
                    onChange={(e) => setClientFilter({ ...clientFilter, '2years': e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>&lt;3 ans</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientFilter['3years']}
                    onChange={(e) => setClientFilter({ ...clientFilter, '3years': e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>&gt;3 ans</span>
                </label>
              </div>
            </div>
          </div>
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
      </div>

      {/* Grille d'entreprises - Design Cards */}
      {filteredAndSortedCompanies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedCompanies.map((company) => (
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
