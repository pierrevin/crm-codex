import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PencilIcon, PlusIcon, TrashIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';
import { recentStorage } from '../services/localStorage';
import { formatSiret, normalizeSiret } from '../utils/formatSiret';
import { searchSirene, fillCompanyFromSirene, type SireneResult } from '../services/sireneApi';

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-100 text-blue-700' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-100 text-purple-700' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-100 text-green-700' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-100 text-rose-700' }
};

type Company = {
  id: string;
  name: string;
  domain?: string;
  isIndividual?: boolean;
  addressStreet?: string;
  addressZip?: string;
  addressCity?: string;
  addressCountry?: string;
  siret?: string;
  siren?: string;
  codeNAF?: string;
  libelleNAF?: string;
  vatNumber?: string;
  linkedinUrl?: string;
  salesNavigatorUrl?: string;
  notes?: string;
  tags?: string[];
  contacts?: any[];
  opportunities?: any[];
};

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [company, setCompany] = useState<Company | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editIsIndividual, setEditIsIndividual] = useState(false);
  const [editAddressStreet, setEditAddressStreet] = useState('');
  const [editAddressZip, setEditAddressZip] = useState('');
  const [editAddressCity, setEditAddressCity] = useState('');
  const [editAddressCountry, setEditAddressCountry] = useState('');
  const [editSiret, setEditSiret] = useState('');
  const [editVat, setEditVat] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editSalesNav, setEditSalesNav] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeCompanyId, setMergeCompanyId] = useState<string | undefined>(undefined);
  const [mergePreview, setMergePreview] = useState<any>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [isSearchingSirene, setIsSearchingSirene] = useState(false);
  const [sireneResults, setSireneResults] = useState<SireneResult[]>([]);
  const [showSireneResults, setShowSireneResults] = useState(false);
  const [isFillingFromSirene, setIsFillingFromSirene] = useState(false);

  useEffect(() => {
    if (id && !isNew) {
      void loadCompany(id);
      void loadAllCompanies();
    }
  }, [id, isNew]);

  const loadAllCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      const companies = Array.isArray(data) ? data : (data.items || data.data || []);
      // Exclure la company actuelle de la liste
      const filtered = companies.filter((c: any) => c.id !== id);
      setAllCompanies(filtered);
    } catch (error) {
      console.error('Erreur chargement companies:', error);
    }
  };

  const loadCompany = async (companyId: string) => {
    setLoading(true);
    try {
      const companyRes = await api.get(`/api/companies/${companyId}`);
      const companyData = companyRes.data;
      // Ajouter au localStorage des récents
      if (companyData.name) {
        recentStorage.addCompany(companyId, companyData.name);
      }
      
      // Les contacts et opportunités sont déjà inclus dans companyData via Prisma include
      // Filtre de sécurité strict : s'assurer que seuls les contacts et opportunités avec le bon companyId sont affichés
      const allContacts = (companyData.contacts || []).filter((c: any) => {
        const matches = c.companyId === companyId;
        if (!matches && c.companyId) {
          console.warn(`Contact ${c.id} (${c.firstName} ${c.lastName}) a un companyId incorrect: ${c.companyId} (attendu: ${companyId})`);
        }
        return matches;
      });
      
      const allOpportunities = (companyData.opportunities || []).filter((o: any) => {
        const matches = o.companyId === companyId;
        if (!matches && o.companyId) {
          console.warn(`Opportunité ${o.id} (${o.title}) a un companyId incorrect: ${o.companyId} (attendu: ${companyId})`);
        }
        return matches;
      });

      // Log pour débogage
      if (companyData.opportunities && companyData.opportunities.length !== allOpportunities.length) {
        console.warn(`Filtrage: ${companyData.opportunities.length} opportunités reçues, ${allOpportunities.length} après filtrage pour companyId=${companyId}`);
      }

      setCompany({
        ...companyData,
        contacts: allContacts,
        opportunities: allOpportunities
      });
      setEditName(companyData.name);
      setEditDomain(companyData.domain || '');
      setEditIsIndividual(!!companyData.isIndividual);
      setEditAddressStreet(companyData.addressStreet || '');
      setEditAddressZip(companyData.addressZip || '');
      setEditAddressCity(companyData.addressCity || '');
      setEditAddressCountry(companyData.addressCountry || '');
      setEditSiret(companyData.siret || '');
      setEditVat(companyData.vatNumber || '');
      // Note: codeNAF et libelleNAF seront chargés depuis la BDD mais ne sont pas dans les champs d'édition pour l'instant
      setEditLinkedin(companyData.linkedinUrl || '');
      setEditSalesNav(companyData.salesNavigatorUrl || '');
      setEditNotes(companyData.notes || '');
      setEditTags((companyData.tags || []).join(', '));
    } catch (error) {
      console.error('Erreur chargement entreprise:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await api.patch(`/api/companies/${id}`, {
        name: editName,
        domain: editDomain || undefined,
        isIndividual: editIsIndividual,
        addressStreet: editAddressStreet || undefined,
        addressZip: editAddressZip || undefined,
        addressCity: editAddressCity || undefined,
        addressCountry: editAddressCountry || undefined,
        siret: editSiret || undefined,
        vatNumber: editVat || undefined,
        linkedinUrl: editLinkedin || undefined,
        salesNavigatorUrl: editSalesNav || undefined,
        notes: editNotes || undefined,
        tags: editTags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      });
      setIsEditing(false);
      await loadCompany(id);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    const hasData = (company?.contacts?.length || 0) > 0 || (company?.opportunities?.length || 0) > 0;
    if (hasData) {
      alert('Impossible de supprimer cette entreprise car elle a des contacts ou des opportunités liés. Supprimez-les d\'abord.');
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'entreprise "${company?.name}" ?`)) {
      return;
    }

    try {
      await api.delete(`/api/companies/${id}`);
      navigate('/clients');
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      alert(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleMergeSelect = async (selectedCompanyId?: string) => {
    setMergeCompanyId(selectedCompanyId);
    if (selectedCompanyId && id) {
      try {
        const { data: mergeCompany } = await api.get(`/api/companies/${selectedCompanyId}`);
        setMergePreview({
          name: mergeCompany.name,
          contacts: mergeCompany.contacts?.length || 0,
          opportunities: mergeCompany.opportunities?.length || 0,
          tags: mergeCompany.tags || []
        });
      } catch (error) {
        console.error('Erreur chargement company à fusionner:', error);
      }
    } else {
      setMergePreview(null);
    }
  };

  const handleSearchSirene = async (searchNameOverride?: string) => {
    // Gérer le cas isNew (formulaire de création) et isEditing
    const searchSiret = isNew || isEditing ? editSiret : (company?.siret || '');
    const searchName = searchNameOverride || (isNew || isEditing ? editName : (company?.name || ''));

    if (!searchSiret && !searchName) {
      return; // Ne pas alerter si c'est une recherche automatique
    }

    setIsSearchingSirene(true);
    setShowSireneResults(false);
    
    try {
      let searchType: 'siret' | 'siren' | 'name' = 'name';
      let searchValue = (searchName || '').trim();

      if (searchSiret && searchSiret.length >= 9 && !searchNameOverride) {
        const normalized = normalizeSiret(searchSiret);
        if (normalized.length === 14) {
          searchType = 'siret';
          searchValue = normalized;
        } else if (normalized.length === 9) {
          searchType = 'siren';
          searchValue = normalized;
        }
      }

      if (!searchValue || searchValue.length < 2) {
        setIsSearchingSirene(false);
        return;
      }

      const response = await searchSirene({ type: searchType, value: searchValue });
      
      if (response.results.length === 0) {
        setSireneResults([]);
        setShowSireneResults(false);
        setIsSearchingSirene(false);
        return;
      }

      setSireneResults(response.results);
      setShowSireneResults(true);
    } catch (error: any) {
      console.error('Erreur recherche Sirene:', error);
      // Ne pas alerter pour les recherches automatiques
      if (!searchNameOverride) {
        const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la recherche Sirene';
        alert(errorMessage);
      }
    } finally {
      setIsSearchingSirene(false);
    }
  };

  // Debounce pour la recherche automatique sur le nom dans le formulaire de création
  useEffect(() => {
    if (!isNew) return; // Seulement pour le formulaire de création
    
    const trimmedName = editName?.trim() || '';
    
    if (trimmedName.length >= 3) {
      const timeoutId = setTimeout(async () => {
        try {
          setIsSearchingSirene(true);
          setShowSireneResults(false);
          
          const response = await searchSirene({ type: 'name', value: trimmedName });
          
          if (response.results.length === 0) {
            setSireneResults([]);
            setShowSireneResults(false);
          } else {
            console.log('Sirene results received:', response.results);
            console.log('First result details:', JSON.stringify(response.results[0], null, 2));
            setSireneResults(response.results);
            setShowSireneResults(true);
          }
        } catch (error: any) {
          console.error('Erreur recherche automatique Sirene:', error);
          setSireneResults([]);
          setShowSireneResults(false);
        } finally {
          setIsSearchingSirene(false);
        }
      }, 500); // Debounce de 500ms

      return () => clearTimeout(timeoutId);
    } else {
      setShowSireneResults(false);
      setSireneResults([]);
    }
  }, [editName, isNew]);

  const handleSelectSireneResult = (result: SireneResult) => {
    // Confirmation avant application
    const confirmMessage = `Confirmez-vous la sélection de cette entreprise ?\n\n` +
      `Nom: ${result.denomination}\n` +
      (result.siret ? `SIRET: ${formatSiret(result.siret)}\n` : '') +
      (result.addressCity ? `Adresse: ${result.addressStreet || ''} ${result.addressZip || ''} ${result.addressCity}\n` : '') +
      (result.codeNAF ? `Code NAF: ${result.codeNAF}${result.libelleNAF ? ` - ${result.libelleNAF}` : ''}` : '');
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Auto-remplir les champs avec les données Sirene
    setEditName(result.denomination);
    setEditSiret(result.siret || '');
    setEditAddressStreet(result.addressStreet || '');
    setEditAddressZip(result.addressZip || '');
    setEditAddressCity(result.addressCity || '');
    setEditAddressCountry(result.addressCountry || 'France');
    setEditIsIndividual(result.isIndividual || false);
    
    // Afficher le code NAF dans les notes si pas de champ dédié (seulement si notes vides)
    if ((result.codeNAF || result.libelleNAF) && !editNotes) {
      const nafInfo = result.libelleNAF 
        ? `Code NAF: ${result.codeNAF} - ${result.libelleNAF}`
        : `Code NAF: ${result.codeNAF}`;
      setEditNotes(nafInfo);
    }

    setShowSireneResults(false);
    setSireneResults([]);
  };

  const handleFillFromSirene = async () => {
    if (!id) return;
    
    setIsFillingFromSirene(true);
    
    try {
      const params: { siret?: string; siren?: string; name?: string } = {};
      
      const searchSiret = isEditing ? editSiret : (company?.siret || '');
      const searchName = isEditing ? editName : (company?.name || '');

      // Validation et normalisation
      if (searchSiret && searchSiret.length >= 9) {
        const normalized = normalizeSiret(searchSiret);
        if (normalized.length === 14) {
          params.siret = normalized;
        } else if (normalized.length === 9) {
          params.siren = normalized;
        }
      }
      
      if (!params.siret && !params.siren) {
        const trimmedName = searchName?.trim();
        if (trimmedName && trimmedName.length >= 2) {
          params.name = trimmedName;
        } else {
          alert('Veuillez saisir un SIRET (14 chiffres), SIREN (9 chiffres) ou nom d\'entreprise valide');
          setIsFillingFromSirene(false);
          return;
        }
      }

      await fillCompanyFromSirene(id, params);
      await loadCompany(id);
      setIsEditing(false);
      alert('Fiche complétée depuis Sirene avec succès');
    } catch (error: any) {
      console.error('Erreur complétion Sirene:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      
      let errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la complétion depuis Sirene';
      
      // Ajouter des détails supplémentaires si disponibles
      if (error.response?.data?.error) {
        const errorDetails = typeof error.response.data.error === 'string' 
          ? error.response.data.error 
          : error.response.data.error.message || JSON.stringify(error.response.data.error);
        errorMessage += `\n\nDétails: ${errorDetails}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsFillingFromSirene(false);
    }
  };

  const handleMerge = async () => {
    if (!id || !mergeCompanyId) return;

    const confirmMessage = `Êtes-vous sûr de vouloir fusionner "${mergePreview?.name}" dans "${company?.name}" ?\n\nCette action est irréversible et la company "${mergePreview?.name}" sera supprimée.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMerging(true);
    try {
      await api.post(`/api/companies/${id}/merge`, { mergeCompanyId });
      alert(`Fusion réussie ! ${mergePreview?.contacts} contact(s) et ${mergePreview?.opportunities} opportunité(s) ont été déplacés.`);
      setShowMergeModal(false);
      setMergeCompanyId(undefined);
      setMergePreview(null);
      await loadCompany(id);
    } catch (error: any) {
      console.error('Erreur fusion:', error);
      alert(error.response?.data?.message || 'Erreur lors de la fusion');
    } finally {
      setIsMerging(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Chargement...</div>;
  }

  // Formulaire de création simple pour nouveau client
  if (isNew) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Créer une entreprise</h1>
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const { data } = await api.post('/api/companies', {
                name: editName,
                domain: editDomain || undefined,
                isIndividual: editIsIndividual,
                addressStreet: editAddressStreet || undefined,
                addressZip: editAddressZip || undefined,
                addressCity: editAddressCity || undefined,
                addressCountry: editAddressCountry || undefined,
                siret: editSiret || undefined,
                vatNumber: editVat || undefined,
                linkedinUrl: editLinkedin || undefined,
                salesNavigatorUrl: editSalesNav || undefined,
                notes: editNotes || undefined,
                tags: editTags
                  .split(',')
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
              });
              navigate(`/clients/${data.id}`);
            } catch (error) {
              console.error('Erreur création:', error);
              alert('Erreur lors de la création');
            }
          }}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Nom de l'entreprise *</label>
            <div className="relative">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                placeholder="Commencez à taper le nom pour rechercher dans Sirene..."
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none pr-10"
              />
              {isSearchingSirene && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-xs text-indigo-600">🔍 Recherche...</span>
                </div>
              )}
            </div>
            {editName && editName.trim().length >= 3 && (
              <p className="mt-1 text-xs text-slate-500">
                Recherche automatique dans Sirene...
              </p>
            )}
          </div>
          
          {/* Résultats recherche Sirene automatique - Sous le champ nom */}
          {showSireneResults && sireneResults.length > 0 && (
            <div className="rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 shadow-lg">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                  {sireneResults.length}
                </span>
                <p className="text-sm font-semibold text-indigo-900">
                  entreprise{sireneResults.length > 1 ? 's' : ''} trouvée{sireneResults.length > 1 ? 's' : ''} dans Sirene
                </p>
              </div>
              <div className="space-y-3">
                {sireneResults.map((result, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectSireneResult(result)}
                    className="w-full text-left rounded-lg border-2 border-indigo-200 bg-white p-4 hover:border-indigo-400 hover:shadow-md transition-all duration-200"
                  >
                    <div className="mb-3">
                      <h4 className="text-lg font-bold text-slate-900 leading-tight mb-2">{result.denomination}</h4>
                      
                      {/* SIRET en évidence */}
                      {result.siret && (
                        <div className="mb-2 flex items-center gap-2 bg-slate-50 px-2 py-1 rounded">
                          <span className="text-xs font-semibold text-slate-600">SIRET:</span>
                          <span className="font-mono text-sm font-bold text-slate-900">{formatSiret(result.siret)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm border-t border-slate-200 pt-2">
                      {/* SIREN si différent du SIRET */}
                      {result.siren && result.siret && result.siren !== result.siret.substring(0, 9) && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">🔢</span>
                          <div className="text-slate-700">
                            <span className="text-xs font-semibold text-slate-600">SIREN: </span>
                            <span className="font-mono text-sm font-semibold text-slate-900">{result.siren}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Adresse complète - Afficher même si seulement code postal ou ville */}
                      {(result.addressStreet || result.addressZip || result.addressCity) && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-500">📍</span>
                          <div className="text-slate-700 flex-1">
                            {result.addressStreet && (
                              <div className="font-medium">{result.addressStreet}</div>
                            )}
                            {(result.addressZip || result.addressCity) && (
                              <div className="text-slate-600">
                                {result.addressZip && (
                                  <span className="font-semibold">{result.addressZip}</span>
                                )}
                                {result.addressZip && result.addressCity && ' '}
                                {result.addressCity && (
                                  <span>{result.addressCity}</span>
                                )}
                              </div>
                            )}
                            {result.addressCountry && result.addressCountry !== 'France' && (
                              <div className="text-xs text-slate-500">{result.addressCountry}</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Code NAF et libellé - Toujours afficher si disponible */}
                      {result.codeNAF && (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-500">🏷️</span>
                          <div className="text-slate-700 flex-1">
                            <div>
                              <span className="font-mono font-semibold text-slate-900">{result.codeNAF}</span>
                              {result.libelleNAF && (
                                <span className="text-slate-600 ml-2">• {result.libelleNAF}</span>
                              )}
                            </div>
                            {result.libelleNAF && (
                              <div className="text-xs text-slate-600 mt-1 leading-relaxed">{result.libelleNAF}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-indigo-100">
                      <span className="text-xs font-medium text-indigo-600">Cliquer pour remplir automatiquement →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">Domaine</label>
            <input
              value={editDomain}
              onChange={(e) => setEditDomain(e.target.value)}
              placeholder="exemple.com"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={editIsIndividual} onChange={(e) => setEditIsIndividual(e.target.checked)} />
              Particulier
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={editAddressStreet}
              onChange={(e) => setEditAddressStreet(e.target.value)}
              placeholder="Adresse"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <input
              value={editAddressZip}
              onChange={(e) => setEditAddressZip(e.target.value)}
              placeholder="Code postal"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <input
              value={editAddressCity}
              onChange={(e) => setEditAddressCity(e.target.value)}
              placeholder="Ville"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <input
              value={editAddressCountry}
              onChange={(e) => setEditAddressCountry(e.target.value)}
              placeholder="Pays"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                value={formatSiret(editSiret)}
                onChange={(e) => {
                  // Normaliser à la saisie (supprimer les espaces)
                  const normalized = normalizeSiret(e.target.value);
                  setEditSiret(normalized);
                }}
                placeholder="SIRET"
                maxLength={17} // 14 chiffres + 3 espaces
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSearchSirene}
                disabled={isSearchingSirene || (!editSiret && !editName)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Rechercher dans Sirene"
              >
                {isSearchingSirene ? '...' : '🔍'}
              </button>
            </div>
            <input
              value={editVat}
              onChange={(e) => setEditVat(e.target.value)}
              placeholder="TVA intracommunautaire"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={editLinkedin}
              onChange={(e) => setEditLinkedin(e.target.value)}
              placeholder="URL LinkedIn"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <input
              value={editSalesNav}
              onChange={(e) => setEditSalesNav(e.target.value)}
              placeholder="URL Sales Navigator"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Notes"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              rows={3}
            />
          </div>
          <div>
            <input
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="Tags (séparés par des virgules)"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/clients')}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!company) {
    return <div className="p-8 text-center text-slate-500">Entreprise non trouvée</div>;
  }

  const totalRevenue = company.opportunities?.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0) || 0;
  const wonRevenue = company.opportunities
    ?.filter(o => o.stage === 'CLOSED_WON')
    .reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* En-tête avec infos éditables */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {!isEditing ? (
              <>
                <h1 className="text-2xl font-semibold text-slate-900">{company.name}</h1>
                {company.domain && (
                  <p className="text-sm text-slate-500 mt-1">🌐 {company.domain}</p>
                )}
                {(company.addressCity || company.addressZip) && (
                  <p className="text-sm text-slate-500 mt-1">{company.addressStreet ? `${company.addressStreet}, ` : ''}{company.addressZip} {company.addressCity} {company.addressCountry || ''}</p>
                )}
                {(company.siret || company.vatNumber || company.codeNAF) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {company.siret ? `SIRET: ${formatSiret(company.siret)}` : ''}
                    {company.siret && company.vatNumber ? ' • ' : ''}
                    {company.vatNumber ? `TVA: ${company.vatNumber}` : ''}
                    {company.codeNAF && `${company.siret || company.vatNumber ? ' • ' : ''}NAF: ${company.codeNAF}${company.libelleNAF ? ` - ${company.libelleNAF}` : ''}`}
                  </p>
                )}
                {(company.linkedinUrl || company.salesNavigatorUrl) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {company.linkedinUrl && <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">LinkedIn</a>}
                    {company.linkedinUrl && company.salesNavigatorUrl ? ' • ' : ''}
                    {company.salesNavigatorUrl && <a href={company.salesNavigatorUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Sales Navigator</a>}
                  </p>
                )}
                {company.tags && company.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {company.tags.map((t) => (
                      <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-semibold border-b-2 border-indigo-500 focus:outline-none"
                />
                <input
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="exemple.com"
                  className="text-sm text-slate-500 border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={editIsIndividual} onChange={(e) => setEditIsIndividual(e.target.checked)} />
                  Particulier
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={editAddressStreet}
                    onChange={(e) => setEditAddressStreet(e.target.value)}
                    placeholder="Adresse"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editAddressZip}
                    onChange={(e) => setEditAddressZip(e.target.value)}
                    placeholder="Code postal"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editAddressCity}
                    onChange={(e) => setEditAddressCity(e.target.value)}
                    placeholder="Ville"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editAddressCountry}
                    onChange={(e) => setEditAddressCountry(e.target.value)}
                    placeholder="Pays"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      value={formatSiret(editSiret)}
                      onChange={(e) => {
                        // Normaliser à la saisie (supprimer les espaces)
                        const normalized = normalizeSiret(e.target.value);
                        setEditSiret(normalized);
                      }}
                      placeholder="SIRET"
                      maxLength={17} // 14 chiffres + 3 espaces
                      className="w-full text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={handleSearchSirene}
                      disabled={isSearchingSirene || (!editSiret && !editName)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Rechercher dans Sirene"
                    >
                      {isSearchingSirene ? '...' : '🔍'}
                    </button>
                  </div>
                  <input
                    value={editVat}
                    onChange={(e) => setEditVat(e.target.value)}
                    placeholder="TVA intracommunautaire"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                
                {/* Résultats recherche Sirene - Formulaire d'édition */}
                {showSireneResults && sireneResults.length > 0 && (
                  <div className="mt-3 rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                        {sireneResults.length}
                      </span>
                      <p className="text-sm font-semibold text-indigo-900">
                        entreprise{sireneResults.length > 1 ? 's' : ''} trouvée{sireneResults.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {sireneResults.map((result, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectSireneResult(result)}
                          className="w-full text-left rounded-lg border-2 border-indigo-200 bg-white p-4 hover:border-indigo-400 hover:shadow-md transition-all duration-200"
                        >
                          <div className="mb-3">
                            <h4 className="text-lg font-bold text-slate-900 leading-tight mb-2">{result.denomination}</h4>
                            
                            {/* SIRET en évidence */}
                            {result.siret && (
                              <div className="mb-2 flex items-center gap-2 bg-slate-50 px-2 py-1 rounded">
                                <span className="text-xs font-semibold text-slate-600">SIRET:</span>
                                <span className="font-mono text-sm font-bold text-slate-900">{formatSiret(result.siret)}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 text-sm border-t border-slate-200 pt-2">
                            {/* Adresse complète */}
                            {(result.addressStreet || result.addressZip || result.addressCity) && (
                              <div className="flex items-start gap-2">
                                <span className="text-slate-500">📍</span>
                                <div className="text-slate-700 flex-1">
                                  {result.addressStreet && (
                                    <div className="font-medium">{result.addressStreet}</div>
                                  )}
                                  {(result.addressZip || result.addressCity) && (
                                    <div className="text-slate-600">
                                      <span className="font-semibold">{result.addressZip}</span> {result.addressCity}
                                    </div>
                                  )}
                                  {result.addressCountry && result.addressCountry !== 'France' && (
                                    <div className="text-xs text-slate-500">{result.addressCountry}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Code NAF et libellé */}
                            {result.codeNAF && (
                              <div className="flex items-start gap-2">
                                <span className="text-slate-500">🏷️</span>
                                <div className="text-slate-700 flex-1">
                                  <span className="font-mono font-semibold text-slate-900">{result.codeNAF}</span>
                                  {result.libelleNAF && (
                                    <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{result.libelleNAF}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* SIREN si différent */}
                            {result.siren && result.siret && result.siren !== result.siret.substring(0, 9) && (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>SIREN:</span>
                                <span className="font-mono">{result.siren}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-3 pt-2 border-t border-indigo-100">
                            <span className="text-xs font-medium text-indigo-600">Cliquer pour remplir automatiquement →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    placeholder="URL LinkedIn"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editSalesNav}
                    onChange={(e) => setEditSalesNav(e.target.value)}
                    placeholder="URL Sales Navigator"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes"
                  className="w-full text-sm border border-slate-300 rounded-md p-2 focus:outline-none focus:border-indigo-500"
                  rows={3}
                />
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="Tags (séparés par des virgules)"
                  className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <PencilIcon className="h-4 w-4" />
                  Modifier
                </button>
                <button
                  onClick={() => setShowMergeModal(true)}
                  className="flex items-center gap-2 rounded-md border border-amber-200 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                >
                  <ArrowRightIcon className="h-4 w-4" />
                  Fusionner
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Supprimer
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleFillFromSirene}
                  disabled={isFillingFromSirene || (!editSiret && !editName)}
                  className="flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isFillingFromSirene ? (
                    <>⏳ Complétion...</>
                  ) : (
                    <>📥 Compléter depuis Sirene</>
                  )}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditName(company.name); setEditDomain(company.domain || ''); }}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Enregistrer
                </button>
              </>
            )}
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-500 uppercase">Contacts</p>
            <p className="text-2xl font-semibold text-slate-900">{company.contacts?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase">Opportunités</p>
            <p className="text-2xl font-semibold text-slate-900">{company.opportunities?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase">CA Total</p>
            <p className="text-2xl font-semibold text-emerald-600">{totalRevenue.toFixed(0)} €</p>
            <p className="text-xs text-slate-500 mt-1">Gagné : {wonRevenue.toFixed(0)} €</p>
          </div>
        </div>
      </div>

      {/* Contacts de l'entreprise */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Contacts ({company.contacts?.length || 0})</h2>
          <Link
            to={`/contacts/new`}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500"
          >
            <PlusIcon className="h-3 w-3" />
            Ajouter
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {company.contacts && company.contacts.length > 0 ? (
            company.contacts.map((contact: any) => (
              <Link
                key={contact.id}
                to={`/contacts/${contact.id}`}
                className="block px-6 py-3 hover:bg-slate-50"
              >
                <p className="text-sm font-medium text-slate-900">
                  👤 {contact.firstName} {contact.lastName || ''}
                </p>
                {contact.email && (
                  <p className="text-xs text-slate-500 mt-1">{contact.email}</p>
                )}
              </Link>
            ))
          ) : (
            <p className="px-6 py-4 text-sm text-slate-500">Aucun contact pour cette entreprise</p>
          )}
        </div>
      </div>

      {/* Opportunités de l'entreprise */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Opportunités ({company.opportunities?.length || 0})</h2>
          <button
            onClick={() => navigate(`/opportunites/new?companyId=${id}`)}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500"
          >
            <PlusIcon className="h-3 w-3" />
            Ajouter
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {company.opportunities && company.opportunities.length > 0 ? (
            company.opportunities.map((opp: any) => (
              <Link
                key={opp.id}
                to={`/opportunites/${opp.id}`}
                className="block px-6 py-3 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{opp.title}</p>
                    {opp.contact && (
                      <p className="text-xs text-slate-500 mt-1">
                        Contact : {opp.contact.firstName} {opp.contact.lastName || ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${STAGES[opp.stage as keyof typeof STAGES]?.color || 'bg-slate-100 text-slate-700'}`}>
                      {STAGES[opp.stage as keyof typeof STAGES]?.label || opp.stage}
                    </span>
                    {opp.amount && (
                      <p className="text-sm font-semibold text-indigo-600 mt-1">
                        {Number(opp.amount).toFixed(2)} €
                      </p>
                    )}
                    {opp.closeDate && (
                      <p className="text-xs text-slate-400 mt-1">
                        📅 {new Date(opp.closeDate).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="px-6 py-4 text-sm text-slate-500">Aucune opportunité pour cette entreprise</p>
          )}
        </div>
      </div>

      {/* Résumé facturation */}
      {company.opportunities && company.opportunities.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">📊 Résumé Facturation</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-slate-500 uppercase mb-1">Pipeline total</p>
              <p className="text-xl font-bold text-slate-900">{totalRevenue.toFixed(2)} €</p>
            </div>
            <div className="rounded-lg bg-white p-4">
              <p className="text-xs text-slate-500 uppercase mb-1">CA Réalisé</p>
              <p className="text-xl font-bold text-emerald-600">{wonRevenue.toFixed(2)} €</p>
            </div>
            {company.opportunities.filter(o => o.closeDate && o.stage !== 'CLOSED_WON' && o.stage !== 'CLOSED_LOST').length > 0 && (
              <div className="col-span-2 rounded-lg bg-white p-4">
                <p className="text-xs text-slate-500 uppercase mb-2">Prochaines facturations</p>
                <div className="space-y-2">
                  {company.opportunities
                    .filter(o => o.closeDate && o.stage !== 'CLOSED_WON' && o.stage !== 'CLOSED_LOST')
                    .sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime())
                    .slice(0, 3)
                    .map((opp: any) => (
                      <div key={opp.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{opp.title}</span>
                        <div className="text-right">
                          <span className="font-semibold text-indigo-600">{Number(opp.amount).toFixed(2)} €</span>
                          <span className="text-xs text-slate-400 ml-2">
                            {new Date(opp.closeDate).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de fusion */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Fusionner des entreprises</h2>
            <p className="mb-4 text-sm text-slate-600">
              Sélectionnez l'entreprise à fusionner dans <strong>{company?.name}</strong>. 
              Tous les contacts et opportunités seront déplacés, et les données seront fusionnées.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Entreprise à fusionner
              </label>
              <CompanySearchSelect
                companies={allCompanies}
                selectedCompanyId={mergeCompanyId}
                onSelectCompany={handleMergeSelect}
                onCreateCompany={async () => {}}
              />
            </div>

            {mergePreview && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-amber-900">Aperçu de la fusion</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700">Entreprise source:</span>
                    <span className="font-medium text-amber-900">{mergePreview.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700">Contacts à déplacer:</span>
                    <span className="font-medium text-amber-900">{mergePreview.contacts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700">Opportunités à déplacer:</span>
                    <span className="font-medium text-amber-900">{mergePreview.opportunities}</span>
                  </div>
                  {mergePreview.tags.length > 0 && (
                    <div>
                      <span className="text-amber-700">Tags:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {mergePreview.tags.map((tag: string) => (
                          <span key={tag} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                  <ArrowRightIcon className="h-4 w-4" />
                  <span>Ces données seront fusionnées dans <strong>{company?.name}</strong></span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeCompanyId(undefined);
                  setMergePreview(null);
                }}
                disabled={isMerging}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleMerge}
                disabled={!mergeCompanyId || isMerging}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {isMerging ? 'Fusion en cours...' : 'Confirmer la fusion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

