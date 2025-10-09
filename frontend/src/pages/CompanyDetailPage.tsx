import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';

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
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (id && !isNew) {
      void loadCompany(id);
    }
  }, [id, isNew]);

  const loadCompany = async (companyId: string) => {
    setLoading(true);
    try {
      const [companyRes, contactsRes, opportunitiesRes] = await Promise.all([
        api.get(`/api/companies/${companyId}`),
        api.get('/api/contacts', { params: { limit: 100 } }),
        api.get('/api/opportunities', { params: { limit: 100 } })
      ]);

      const companyData = companyRes.data;
      const allContacts = contactsRes.data.items || contactsRes.data.data || [];
      const allOpportunities = opportunitiesRes.data.items || opportunitiesRes.data.data || [];

      setCompany({
        ...companyData,
        contacts: allContacts.filter((c: any) => c.companyId === companyId),
        opportunities: allOpportunities.filter((o: any) => o.companyId === companyId)
      });
      setEditName(companyData.name);
      setEditDomain(companyData.domain || '');
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
        domain: editDomain || undefined
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
      navigate('/companies');
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      alert(error.response?.data?.message || 'Erreur lors de la suppression');
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
                domain: editDomain || undefined
              });
              navigate(`/companies/${data.id}`);
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
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/companies')}
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
            onClick={() => navigate(`/opportunities/new?companyId=${id}`)}
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
                to={`/opportunities/${opp.id}`}
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
    </div>
  );
}

