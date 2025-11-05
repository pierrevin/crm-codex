import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, BuildingOfficeIcon, UserIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import api from '../services/apiClient';

type SearchResult = {
  type: 'company' | 'contact' | 'opportunity';
  id: string;
  title: string;
  subtitle?: string;
  url: string;
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche avec debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      void performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    setShowResults(true);

    try {
      const [companiesRes, contactsRes, opportunitiesRes] = await Promise.all([
        api.get('/api/companies', { params: { search: searchQuery } }).catch((err) => {
          console.error('Erreur recherche entreprises:', err);
          return { data: [] };
        }),
        api.get('/api/contacts', { params: { search: searchQuery, limit: 5 } }).catch((err) => {
          console.error('Erreur recherche contacts:', err);
          return { data: { items: [], data: [] } };
        }),
        api.get('/api/opportunities', { params: { search: searchQuery, limit: 50 } }).catch((err) => {
          console.error('Erreur recherche opportunités:', err);
          return { data: { items: [], data: [] } };
        })
      ]);

      const companies = Array.isArray(companiesRes.data) ? companiesRes.data : [];
      const contacts = contactsRes.data.items || contactsRes.data.data || [];
      const opportunities = opportunitiesRes.data.items || opportunitiesRes.data.data || [];
      
      console.log('Résultats recherche globale:', {
        companies: companies.length,
        contacts: contacts.length,
        opportunities: opportunities.length,
        opportunitiesData: opportunities
      });

      // Mapper les résultats
      const filteredCompanies = companies
        .slice(0, 3)
        .map((c: any): SearchResult => ({
          type: 'company',
          id: c.id,
          title: c.name,
          subtitle: c.domain,
          url: `/entreprises/${c.id}`
        }));

      const filteredContacts = contacts
        .slice(0, 3)
        .map((c: any): SearchResult => ({
          type: 'contact',
          id: c.id,
          title: `${c.firstName} ${c.lastName || ''}`.trim(),
          subtitle: c.company?.name || c.email,
          url: `/contacts/${c.id}`
        }));

      const filteredOpportunities = opportunities
        .slice(0, 3)
        .map((o: any): SearchResult => ({
          type: 'opportunity',
          id: o.id,
          title: o.title,
          subtitle: o.company?.name || `${o.amount ? `${o.amount}€` : ''}`,
          url: `/opportunites/${o.id}`
        }));

      setResults([...filteredCompanies, ...filteredContacts, ...filteredOpportunities]);
    } catch (error) {
      console.error('Erreur recherche globale:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url);
    setQuery('');
    setShowResults(false);
    inputRef.current?.blur();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'company':
        return <BuildingOfficeIcon className="h-5 w-5 text-indigo-600" />;
      case 'contact':
        return <UserIcon className="h-5 w-5 text-blue-600" />;
      case 'opportunity':
        return <BriefcaseIcon className="h-5 w-5 text-purple-600" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'company':
        return 'Client';
      case 'contact':
        return 'Contact';
      case 'opportunity':
        return 'Opportunité';
      default:
        return '';
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setShowResults(true)}
          placeholder="Rechercher un client, contact ou opportunité..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown résultats */}
      {showResults && query.trim() && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl max-h-96 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-slate-500">Recherche en cours...</div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex-shrink-0">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{result.title}</p>
                      <span className="flex-shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {getTypeLabel(result.type)}
                      </span>
                    </div>
                    {result.subtitle && (
                      <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500">
              Aucun résultat trouvé pour "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

