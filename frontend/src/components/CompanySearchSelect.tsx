import { useEffect, useState } from 'react';
import { searchSirene, type SireneResult } from '../services/sireneApi';
import { formatSiret } from '../utils/formatSiret';

export function CompanySearchSelect({
  companies,
  selectedCompanyId,
  onSelectCompany,
  onCreateCompany
}: {
  companies: any[];
  selectedCompanyId?: string;
  onSelectCompany: (companyId?: string) => void;
  onCreateCompany: (name: string, companyData?: any) => Promise<any>;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearchingSirene, setIsSearchingSirene] = useState(false);
  const [sireneResults, setSireneResults] = useState<SireneResult[]>([]);
  const [showSireneResults, setShowSireneResults] = useState(false);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.company-search-container')) {
        setShowDropdown(false);
        setShowSireneResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche automatique Sirene quand on tape dans le champ
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 3) {
      setShowSireneResults(false);
      setSireneResults([]);
      return;
    }

    // Ne chercher que si aucune entreprise n'est sélectionnée
    if (selectedCompanyId) return;

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearchingSirene(true);
        const response = await searchSirene({ type: 'name', value: searchTerm.trim() });
        
        if (response.results.length > 0) {
          console.log('CompanySearchSelect - Sirene results received:', response.results);
          console.log('CompanySearchSelect - First result:', JSON.stringify(response.results[0], null, 2));
          setSireneResults(response.results);
          setShowSireneResults(true);
        } else {
          setSireneResults([]);
          setShowSireneResults(false);
        }
      } catch (error) {
        console.error('Erreur recherche Sirene:', error);
        setSireneResults([]);
        setShowSireneResults(false);
      } finally {
        setIsSearchingSirene(false);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedCompanyId]);

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
    setShowSireneResults(false);
  };

  const handleSelectSireneResult = async (result: SireneResult) => {
    // Confirmation avant création
    const confirmMessage = `Créer l'entreprise "${result.denomination}" depuis Sirene ?\n\n` +
      `SIRET: ${result.siret}\n` +
      (result.addressCity ? `Adresse: ${result.addressStreet || ''} ${result.addressZip || ''} ${result.addressCity}\n` : '') +
      (result.codeNAF ? `Code NAF: ${result.codeNAF}${result.libelleNAF ? ` - ${result.libelleNAF}` : ''}` : '');
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setIsCreating(true);
      // Créer l'entreprise avec toutes les données Sirene
      const companyData: any = {
        name: result.denomination,
        siret: result.siret,
        siren: result.siren,
        codeNAF: result.codeNAF,
        libelleNAF: result.libelleNAF,
        addressStreet: result.addressStreet,
        addressZip: result.addressZip,
        addressCity: result.addressCity,
        addressCountry: result.addressCountry || 'France',
        isIndividual: result.isIndividual
      };

      // Utiliser l'API pour créer l'entreprise complète
      const newCompany = await onCreateCompany(companyData.name, companyData);
      
      onSelectCompany(newCompany.id);
      setSearchTerm('');
      setShowDropdown(false);
      setShowSireneResults(false);
      setSireneResults([]);
    } catch (error) {
      console.error('Erreur création entreprise depuis Sirene:', error);
      alert('Erreur lors de la création de l\'entreprise');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClear = () => {
    onSelectCompany(undefined);
    setSearchTerm('');
    setShowSireneResults(false);
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
          placeholder="Rechercher ou créer une entreprise..."
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
        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-96 overflow-auto">
          {/* 1. Entreprises existantes en premier */}
          {filteredCompanies.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-700">
                  🏢 Entreprises existantes ({filteredCompanies.length})
                </p>
              </div>
              <div className="max-h-48 overflow-auto">
                {filteredCompanies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelectCompany(company)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-b-0"
                  >
                    <span className="text-slate-400">🏢</span>
                    <span className="font-medium">{company.name}</span>
                    {company.domain && (
                      <span className="text-xs text-slate-400 ml-auto">{company.domain}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Bouton créer une nouvelle entreprise */}
          {searchTerm && !exactMatch && (
            <div className={filteredCompanies.length > 0 ? 'border-t border-slate-200' : ''}>
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={isCreating}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-indigo-50 flex items-center gap-2 text-indigo-600 font-medium border-b border-indigo-100"
              >
                <span>✨</span>
                {isCreating ? (
                  <span>Création en cours...</span>
                ) : (
                  <>
                    <span>Créer une nouvelle entreprise</span>
                    <span className="font-semibold ml-1">"{searchTerm}"</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 3. Résultats Sirene en dernier avec détails complets */}
          {showSireneResults && sireneResults.length > 0 && (
            <div className={filteredCompanies.length > 0 || (searchTerm && !exactMatch) ? 'border-t-2 border-indigo-200' : ''}>
              <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-200">
                <p className="text-xs font-semibold text-indigo-900">
                  🔍 {sireneResults.length} entreprise{sireneResults.length > 1 ? 's' : ''} trouvée{sireneResults.length > 1 ? 's' : ''} dans Sirene
                </p>
                <p className="text-xs text-indigo-600 mt-0.5">Cliquez pour créer avec toutes les informations</p>
              </div>
              <div className="max-h-64 overflow-auto">
                {sireneResults.map((result, index) => (
                  <button
                    key={`sirene-${index}`}
                    type="button"
                    onClick={() => handleSelectSireneResult(result)}
                    disabled={isCreating}
                    className="w-full px-3 py-3 text-left hover:bg-indigo-50 border-b border-indigo-100 last:border-b-0 transition-colors"
                  >
                    {/* Nom de l'entreprise en évidence */}
                    <div className="font-bold text-sm text-slate-900 mb-2">{result.denomination}</div>
                    
                    <div className="space-y-1.5">
                      {/* SIRET en évidence - Toujours afficher si disponible */}
                      {result.siret && (
                        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded">
                          <span className="text-xs font-semibold text-slate-600">SIRET:</span>
                          <span className="font-mono text-xs font-bold text-slate-900">{formatSiret(result.siret)}</span>
                        </div>
                      )}
                      
                      {/* SIREN si différent du SIRET */}
                      {result.siren && result.siret && result.siren !== result.siret.substring(0, 9) && (
                        <div className="text-xs text-slate-600">
                          <span className="text-slate-500 mr-1">🔢</span>
                          <span>SIREN: <span className="font-mono font-semibold">{result.siren}</span></span>
                        </div>
                      )}
                      
                      {/* Adresse complète - Afficher même si seulement code postal ou ville */}
                      {(result.addressStreet || result.addressZip || result.addressCity) && (
                        <div className="text-xs text-slate-700">
                          <span className="text-slate-500 mr-1">📍</span>
                          <span>
                            {result.addressStreet && (
                              <span className="font-medium">{result.addressStreet}</span>
                            )}
                            {result.addressStreet && (result.addressZip || result.addressCity) && ', '}
                            {result.addressZip && (
                              <span className="font-semibold">{result.addressZip}</span>
                            )}
                            {result.addressZip && result.addressCity && ' '}
                            {result.addressCity && (
                              <span>{result.addressCity}</span>
                            )}
                            {/* Si seulement code postal ou ville */}
                            {!result.addressStreet && result.addressZip && result.addressCity && (
                              <span>{result.addressZip} {result.addressCity}</span>
                            )}
                            {!result.addressStreet && !result.addressZip && result.addressCity && (
                              <span>{result.addressCity}</span>
                            )}
                            {!result.addressStreet && result.addressZip && !result.addressCity && (
                              <span>{result.addressZip}</span>
                            )}
                          </span>
                        </div>
                      )}
                      
                      {/* Code NAF et libellé complet - Toujours afficher si disponible */}
                      {result.codeNAF && (
                        <div className="text-xs text-slate-700">
                          <span className="text-slate-500 mr-1">🏷️</span>
                          <span>
                            <span className="font-mono font-semibold text-slate-900">{result.codeNAF}</span>
                            {result.libelleNAF && (
                              <span className="text-slate-600 ml-1">• {result.libelleNAF}</span>
                            )}
                          </span>
                        </div>
                      )}
                      
                      {/* Message si aucune info supplémentaire disponible */}
                      {!result.siret && !result.addressStreet && !result.addressZip && !result.addressCity && !result.codeNAF && (
                        <div className="text-xs text-slate-500 italic">
                          Informations limitées disponibles
                        </div>
                      )}
                    </div>
                    
                    {/* Call to action */}
                    <div className="text-xs text-indigo-600 font-medium mt-2 pt-1.5 border-t border-indigo-100">
                      Cliquer pour créer avec toutes ces informations →
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Indicateur de recherche */}
          {isSearchingSirene && (
            <div className="px-3 py-2 text-sm text-slate-500 border-t border-slate-100">
              🔍 Recherche dans Sirene...
            </div>
          )}

          {/* Message vide */}
          {!searchTerm && filteredCompanies.length === 0 && !showSireneResults && !isSearchingSirene && (
            <div className="px-3 py-2 text-sm text-slate-500">
              Tapez pour rechercher ou créer une entreprise
            </div>
          )}
        </div>
      )}
    </div>
  );
}

