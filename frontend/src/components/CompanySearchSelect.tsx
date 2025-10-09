import { useEffect, useState } from 'react';

export function CompanySearchSelect({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onCreateCompany
}: {
  companies: any[];
  selectedCompanyId?: string;
  onSelectCompany: (companyId?: string) => void;
  onCreateCompany: (name: string) => Promise<void>;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.company-search-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exactMatch = filteredCompanies.find(
    c => c.name.toLowerCase() === searchTerm.toLowerCase()
  );

  const handleCreateNew = async () => {
    if (!searchTerm.trim()) return;
    setIsCreating(true);
    try {
      await onCreateCompany(searchTerm.trim());
      setSearchTerm('');
      setShowDropdown(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCompany = (company: any) => {
    onSelectCompany(company.id);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelectCompany(undefined);
    setSearchTerm('');
  };

  return (
    <div className="relative company-search-container">
      <div className="relative">
        <input
          type="text"
          value={selectedCompany ? selectedCompany.name : searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
            if (selectedCompany) {
              onSelectCompany(undefined);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Rechercher ou créer un client..."
          className="w-full rounded-md border border-slate-200 px-3 py-2 pr-20 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {selectedCompany && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && !selectedCompany && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-60 overflow-auto">
          {filteredCompanies.length > 0 ? (
            <div>
              {filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleSelectCompany(company)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <span className="text-slate-400">🏢</span>
                  <span>{company.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          {searchTerm && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={isCreating}
              className="w-full px-3 py-2 text-left text-sm border-t border-slate-100 hover:bg-indigo-50 flex items-center gap-2 text-indigo-600 font-medium"
            >
              <span>✨</span>
              {isCreating ? (
                <span>Création...</span>
              ) : (
                <>
                  <span>Créer</span>
                  <span className="font-semibold">"{searchTerm}"</span>
                </>
              )}
            </button>
          )}

          {!searchTerm && filteredCompanies.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">
              Tapez pour rechercher ou créer un client
            </div>
          )}
        </div>
      )}
    </div>
  );
}

