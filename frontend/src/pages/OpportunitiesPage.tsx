import { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';
import { ContactSearchSelect } from '../components/ContactSearchSelect';

type Opportunity = {
  id: string;
  title: string;
  stage: 'QUALIFICATION' | 'PROPOSAL' | 'CLOSED_WON' | 'CLOSED_LOST';
  amount?: number;
  closeDate?: string;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

type PaginatedResponse<T> = {
  data?: T[];
  items?: T[];
  nextCursor?: string | null;
  total?: number;
};

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-100 text-blue-700' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-100 text-purple-700' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-100 text-green-700' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-100 text-rose-700' }
};

export function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [draggedOpp, setDraggedOpp] = useState<Opportunity | null>(null);

  useEffect(() => {
    void loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    const { data } = await api.get<PaginatedResponse<Opportunity>>('/api/opportunities');
      setOpportunities(data.items || data.data || []);
  };

  const handleDragStart = (opp: Opportunity) => {
    setDraggedOpp(opp);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStage: keyof typeof STAGES) => {
    if (!draggedOpp || draggedOpp.stage === newStage) {
      setDraggedOpp(null);
      return;
    }

    try {
      // Mise à jour optimiste
      setOpportunities(opps => 
        opps.map(o => o.id === draggedOpp.id ? { ...o, stage: newStage } : o)
      );

      // Mise à jour API
      await api.patch(`/api/opportunities/${draggedOpp.id}`, { stage: newStage });
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      // Recharger en cas d'erreur
      await loadOpportunities();
    } finally {
      setDraggedOpp(null);
    }
  };

  const opportunitiesByStage = Object.keys(STAGES).reduce((acc, stage) => {
    acc[stage as keyof typeof STAGES] = opportunities.filter(o => o.stage === stage);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  const totalByStage = Object.keys(STAGES).reduce((acc, stage) => {
    const stageOpps = opportunitiesByStage[stage] || [];
    acc[stage] = stageOpps.reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      <div>
          <h1 className="text-2xl font-semibold text-slate-900">Opportunités</h1>
          <p className="text-sm text-slate-500">Suivez vos affaires et leur progression.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-md border border-slate-200 bg-white">
            <button
              onClick={() => setView('kanban')}
              className={`px-4 py-2 text-sm font-medium ${view === 'kanban' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 text-sm font-medium ${view === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}
            >
              Liste
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4" />
            Nouvelle opportunité
          </button>
        </div>
      </div>

      {view === 'kanban' && (
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(STAGES).map(([stage, { label, color }]) => (
            <div 
              key={stage} 
              className={`flex flex-col rounded-lg border-2 ${draggedOpp ? 'border-dashed border-indigo-300' : 'border-slate-200'} bg-slate-50 min-h-96`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage as keyof typeof STAGES)}
            >
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                <p className="text-xs text-slate-500">{opportunitiesByStage[stage]?.length || 0} opportunité(s)</p>
                <div className="mt-1 space-y-1">
                  <p className="text-sm font-semibold text-slate-700">
                    CA: {(totalByStage[stage] || 0).toFixed(2)} €
                  </p>
                  <p className="text-sm font-semibold text-emerald-600">
                    Net (-27%): {((totalByStage[stage] || 0) * 0.73).toFixed(2)} €
                  </p>
                </div>
              </div>
              <div className="flex-1 space-y-2 p-3">
                {opportunitiesByStage[stage]?.map((opp) => (
                  <div
                    key={opp.id}
                    draggable
                    onDragStart={() => handleDragStart(opp)}
                    onClick={() => window.location.href = `/opportunites/${opp.id}`}
                    className={`w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-all cursor-move text-left ${draggedOpp?.id === opp.id ? 'opacity-50' : ''}`}
                  >
                    <h4 className="font-medium text-slate-900 text-sm mb-1">{opp.title}</h4>
                    {opp.amount && (
                      <p className="text-sm font-semibold text-indigo-600 mb-1">
                        {Number(opp.amount).toFixed(2)} €
                      </p>
                    )}
                    {opp.closeDate && (
                      <p className="text-xs text-slate-400 mb-1">
                        📅 {new Date(opp.closeDate).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      {opp.contact
                        ? `${opp.contact.firstName} ${opp.contact.lastName ?? ''}`
                        : opp.company?.name ?? 'Sans client'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Étape</th>
                <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opportunities.map((opportunity) => (
                <tr 
                  key={opportunity.id} 
                  onClick={() => window.location.href = `/opportunites/${opportunity.id}`}
                  className="text-sm text-slate-700 cursor-pointer hover:bg-slate-50"
                >
                <td className="px-4 py-3 font-medium text-slate-900">{opportunity.title}</td>
                <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STAGES[opportunity.stage].color}`}>
                      {STAGES[opportunity.stage].label}
                  </span>
                </td>
                  <td className="px-4 py-3">
                    <div>
                      {opportunity.amount !== undefined && opportunity.amount !== null 
                        ? `${Number(opportunity.amount).toFixed(2)} €` 
                        : '-'}
                    </div>
                    {opportunity.closeDate && (
                      <div className="text-xs text-slate-400 mt-1">
                        📅 {new Date(opportunity.closeDate).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </td>
                <td className="px-4 py-3">
                  {opportunity.contact
                    ? `${opportunity.contact.firstName} ${opportunity.contact.lastName ?? ''}`
                    : opportunity.company?.name ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}


      {showModal && <CreateOpportunityModal onClose={() => setShowModal(false)} onCreated={loadOpportunities} />}
    </div>
  );
}

function CreateOpportunityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<keyof typeof STAGES>('QUALIFICATION');
  const [amount, setAmount] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | undefined>();
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>();

  useEffect(() => {
    void loadContacts();
    void loadCompanies();
  }, []);

  const loadContacts = async () => {
    const { data } = await api.get('/api/contacts');
    setContacts(data.items || data.data || []);
  };

  const loadCompanies = async () => {
    const { data } = await api.get('/api/companies');
    setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
  };

  // Filtrer les contacts par client sélectionné
  const filteredContacts = selectedCompany 
    ? contacts.filter(c => c.companyId === selectedCompany)
    : contacts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCompany) {
      alert('Veuillez sélectionner un client');
      return;
    }

    try {
      await api.post('/api/opportunities', {
        title,
        stage,
        amount: amount ? parseFloat(amount) : undefined,
        closeDate: closeDate || undefined,
        contactId: selectedContact,
        companyId: selectedCompany
      });
      onCreated();
      onClose();
    } catch (error) {
      console.error('Erreur création opportunité:', error);
      alert('Erreur lors de la création');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Nouvelle opportunité</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CLIENT EN PRIORITÉ */}
          <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-200">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              🏢 Client *
              <span className="text-xs text-slate-500 ml-2">(À renseigner en premier)</span>
            </label>
            <CompanySearchSelect
              companies={companies}
              selectedCompanyId={selectedCompany}
              onSelectCompany={(companyId) => {
                setSelectedCompany(companyId);
                // Réinitialiser le contact si le client change
                if (selectedContact) {
                  const contact = contacts.find(c => c.id === selectedContact);
                  if (contact && contact.companyId !== companyId) {
                    setSelectedContact(undefined);
                  }
                }
              }}
              onCreateCompany={async (name) => {
                const { data: newCompany } = await api.post('/api/companies', { name });
                setCompanies([...companies, newCompany]);
                setSelectedCompany(newCompany.id);
              }}
            />
          </div>

          {/* CONTACT (filtré par client) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              👤 Contact
              {selectedCompany && filteredContacts.length > 0 && (
                <span className="text-xs text-slate-500 ml-2">
                  ({filteredContacts.length} contact(s) chez ce client)
                </span>
              )}
            </label>
            {selectedCompany ? (
              <ContactSearchSelect
                contacts={filteredContacts}
                selectedContactId={selectedContact}
                defaultCompanyId={selectedCompany}
                defaultCompanyName={companies.find(c => c.id === selectedCompany)?.name}
                onSelectContact={(contactId) => setSelectedContact(contactId)}
                onCreateContact={async (firstName, lastName, companyId) => {
                  const { data: newContact } = await api.post('/api/contacts', { 
                    firstName, 
                    lastName: lastName || undefined,
                    companyId: companyId || undefined
                  });
                  setContacts([...contacts, newContact]);
                  setSelectedContact(newContact.id);
                }}
              />
            ) : (
              <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                Sélectionnez d'abord un client
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Titre de l'opportunité *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Étape</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as keyof typeof STAGES)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {Object.entries(STAGES).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant (€)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date prévisionnelle de facturation</label>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

