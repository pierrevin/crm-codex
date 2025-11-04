import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PencilIcon, PlusIcon, TrashIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';
import { recentStorage } from '../services/localStorage';
import { formatSiret, normalizeSiret } from '../utils/formatSiret';

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
      setEditLinkedin(companyData.linkedinUrl || '');
      setEditSalesNav(companyData.salesNavigatorUrl || '');
      setEditNotes(companyData.notes || '');
      setEditTags((companyData.tags || []).join(', '));
    } catch (error) {
      console.error('Erreur chargement client:', error);
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
      alert('Impossible de supprimer ce client car il a des contacts ou des opportunités liés. Supprimez-les d\'abord.');
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le client "${company?.name}" ?`)) {
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
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">Créer un client</h1>
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
            <label className="block text-sm font-medium text-slate-700">Nom du client *</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
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
    return <div className="p-8 text-center text-slate-500">Client non trouvé</div>;
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
                {(company.siret || company.vatNumber) && (
                  <p className="text-xs text-slate-400 mt-1">{company.siret ? `SIRET: ${formatSiret(company.siret)}` : ''}{company.siret && company.vatNumber ? ' • ' : ''}{company.vatNumber ? `TVA: ${company.vatNumber}` : ''}</p>
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
                  <input
                    value={formatSiret(editSiret)}
                    onChange={(e) => {
                      // Normaliser à la saisie (supprimer les espaces)
                      const normalized = normalizeSiret(e.target.value);
                      setEditSiret(normalized);
                    }}
                    placeholder="SIRET"
                    maxLength={17} // 14 chiffres + 3 espaces
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    value={editVat}
                    onChange={(e) => setEditVat(e.target.value)}
                    placeholder="TVA intracommunautaire"
                    className="text-sm border-b border-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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

      {/* Contacts du client */}
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
            <p className="px-6 py-4 text-sm text-slate-500">Aucun contact pour ce client</p>
          )}
        </div>
      </div>

      {/* Opportunités du client */}
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
            <p className="px-6 py-4 text-sm text-slate-500">Aucune opportunité pour ce client</p>
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
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Fusionner des clients</h2>
            <p className="mb-4 text-sm text-slate-600">
              Sélectionnez le client à fusionner dans <strong>{company?.name}</strong>. 
              Tous les contacts et opportunités seront déplacés, et les données seront fusionnées.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Client à fusionner
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
                    <span className="text-amber-700">Client source:</span>
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

