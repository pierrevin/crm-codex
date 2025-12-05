import { useEffect, useState } from 'react';
import { searchSirene, type SireneResult } from '../services/sireneApi';
import { formatSiret } from '../utils/formatSiret';
import api from '../services/apiClient';

export function SupplierSearchSelect({
  selectedSupplierId,
  onSelectSupplier,
  onCreateSupplier
}: {
  selectedSupplierId?: string;
  onSelectSupplier: (supplierId?: string, supplierName?: string) => void;
  onCreateSupplier: (name: string, companyData?: any) => Promise<any>;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearchingSirene, setIsSearchingSirene] = useState(false);
  const [sireneResults, setSireneResults] = useState<SireneResult[]>([]);
  const [showSireneResults, setShowSireneResults] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Charger toutes les entreprises (pour permettre de convertir un client en fournisseur)
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        setLoading(true);
        const { data: companiesData } = await api.get('/api/companies');
        const companies = Array.isArray(companiesData) ? companiesData : (companiesData.items || companiesData.data || []);
        setAllCompanies(companies);
        const suppliersList = companies.filter((company: any) => company.statusSupplier === true);
        setSuppliers(suppliersList);
      } catch (error) {
        console.error('Erreur chargement fournisseurs:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadSuppliers();
  }, []);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.supplier-search-container')) {
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

    // Ne chercher que si aucun fournisseur n'est sélectionné
    if (selectedSupplierId) return;

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearchingSirene(true);
        const response = await searchSirene({ type: 'name', value: searchTerm.trim() });
        
        if (response.results.length > 0) {
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
  }, [searchTerm, selectedSupplierId]);

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Trouver les entreprises qui correspondent mais ne sont pas encore fournisseurs
  const matchingNonSuppliers = allCompanies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !company.statusSupplier &&
    !suppliers.find(s => s.id === company.id)
  );

  const exactMatch = filteredSuppliers.find(
    s => s.name.toLowerCase() === searchTerm.toLowerCase()
  );

  const handleCreateNew = async () => {
    if (!searchTerm.trim()) return;
    setIsCreating(true);
    try {
      // Créer l'entreprise avec statusSupplier = true
      const newSupplier = await onCreateSupplier(searchTerm.trim(), { statusSupplier: true });
      setSearchTerm('');
      setShowDropdown(false);
      // Recharger la liste des fournisseurs
      const { data: companiesData } = await api.get('/api/companies');
      const allCompanies = Array.isArray(companiesData) ? companiesData : (companiesData.items || companiesData.data || []);
      const suppliersList = allCompanies.filter((company: any) => company.statusSupplier === true);
      setSuppliers(suppliersList);
      onSelectSupplier(newSupplier.id, newSupplier.name);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectSupplier = (supplier: any) => {
    onSelectSupplier(supplier.id, supplier.name);
    setSearchTerm('');
    setShowDropdown(false);
    setShowSireneResults(false);
  };

  // Convertir un client existant en fournisseur
  const handleConvertToSupplier = async (company: any) => {
    try {
      setIsCreating(true);
      // Mettre à jour l'entreprise pour ajouter statusSupplier = true
      const { data: updatedCompany } = await api.patch(`/api/companies/${company.id}`, {
        statusSupplier: true
      });
      
      // Recharger la liste
      const { data: companiesData } = await api.get('/api/companies');
      const companies = Array.isArray(companiesData) ? companiesData : (companiesData.items || companiesData.data || []);
      setAllCompanies(companies);
      const suppliersList = companies.filter((c: any) => c.statusSupplier === true);
      setSuppliers(suppliersList);
      
      onSelectSupplier(updatedCompany.id, updatedCompany.name);
      setSearchTerm('');
      setShowDropdown(false);
      setShowSireneResults(false);
    } catch (error) {
      console.error('Erreur conversion en fournisseur:', error);
      alert('Erreur lors de la conversion en fournisseur');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectSireneResult = async (result: SireneResult) => {
    // Confirmation avant création
    const confirmMessage = `Créer le fournisseur "${result.denomination}" depuis Sirene ?\n\n` +
      `SIRET: ${result.siret}\n` +
      (result.addressCity ? `Adresse: ${result.addressStreet || ''} ${result.addressZip || ''} ${result.addressCity}\n` : '') +
      (result.codeNAF ? `Code NAF: ${result.codeNAF}${result.libelleNAF ? ` - ${result.libelleNAF}` : ''}` : '');
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setIsCreating(true);
      // Créer l'entreprise avec toutes les données Sirene et statusSupplier = true
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
        isIndividual: result.isIndividual,
        statusSupplier: true // Marquer comme fournisseur
      };

      // Utiliser l'API pour créer l'entreprise complète
      const newSupplier = await onCreateSupplier(companyData.name, companyData);
      
      // Recharger la liste des fournisseurs
      const { data: companiesData } = await api.get('/api/companies');
      const allCompanies = Array.isArray(companiesData) ? companiesData : (companiesData.items || companiesData.data || []);
      const suppliersList = allCompanies.filter((company: any) => company.statusSupplier === true);
      setSuppliers(suppliersList);
      
      onSelectSupplier(newSupplier.id, newSupplier.name);
      setSearchTerm('');
      setShowDropdown(false);
      setShowSireneResults(false);
      setSireneResults([]);
    } catch (error) {
      console.error('Erreur création fournisseur depuis Sirene:', error);
      alert('Erreur lors de la création du fournisseur');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClear = () => {
    onSelectSupplier(undefined, undefined);
    setSearchTerm('');
    setShowSireneResults(false);
  };

  return (
    <div className="relative supplier-search-container">
      <div className="relative">
        <input
          type="text"
          value={selectedSupplier ? selectedSupplier.name : searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
            if (selectedSupplier) {
              onSelectSupplier(undefined, undefined);
            }
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Rechercher ou créer un fournisseur..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-20 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        {selectedSupplier && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && !selectedSupplier && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-96 overflow-auto">
          {/* 1. Fournisseurs existants en premier */}
          {filteredSuppliers.length > 0 && (
            <div>
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-700">
                  🏢 Fournisseurs existants ({filteredSuppliers.length})
                </p>
              </div>
              <div className="max-h-48 overflow-auto">
                {filteredSuppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => handleSelectSupplier(supplier)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-b-0"
                  >
                    <span className="text-slate-400">🏢</span>
                    <span className="font-medium">{supplier.name}</span>
                    {supplier.domain && (
                      <span className="text-xs text-slate-400 ml-auto">{supplier.domain}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Entreprises existantes qui ne sont pas encore fournisseurs */}
          {matchingNonSuppliers.length > 0 && (
            <div className={filteredSuppliers.length > 0 ? 'border-t border-slate-200' : ''}>
              <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                <p className="text-xs font-semibold text-amber-900">
                  🏢 Entreprises existantes (pas encore fournisseurs) ({matchingNonSuppliers.length})
                </p>
              </div>
              <div className="max-h-48 overflow-auto">
                {matchingNonSuppliers.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleConvertToSupplier(company)}
                    disabled={isCreating}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-amber-50 flex items-center gap-2 border-b border-amber-50 last:border-b-0 disabled:opacity-50"
                  >
                    <span className="text-amber-600">🔄</span>
                    <span className="font-medium">{company.name}</span>
                    <span className="text-xs text-amber-600 ml-auto">Convertir en fournisseur</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Bouton créer un nouveau fournisseur */}
          {searchTerm && !exactMatch && matchingNonSuppliers.length === 0 && (
            <div className={filteredSuppliers.length > 0 ? 'border-t border-slate-200' : ''}>
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
                    <span>Créer un nouveau fournisseur</span>
                    <span className="font-semibold ml-1">"{searchTerm}"</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 4. Résultats Sirene en dernier avec détails complets */}
          {showSireneResults && sireneResults.length > 0 && (
            <div className={filteredSuppliers.length > 0 || matchingNonSuppliers.length > 0 || (searchTerm && !exactMatch && matchingNonSuppliers.length === 0) ? 'border-t-2 border-indigo-200' : ''}>
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
                      {/* SIRET en évidence */}
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
                      
                      {/* Adresse complète */}
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
                          </span>
                        </div>
                      )}
                      
                      {/* Code NAF et libellé */}
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
          {!searchTerm && filteredSuppliers.length === 0 && !showSireneResults && !isSearchingSirene && (
            <div className="px-3 py-2 text-sm text-slate-500">
              Tapez pour rechercher ou créer un fournisseur
            </div>
          )}
        </div>
      )}
    </div>
  );
}

