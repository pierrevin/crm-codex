import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TrashIcon, PlusIcon, DocumentTextIcon, BanknotesIcon, ReceiptRefundIcon, DocumentDuplicateIcon, ChevronDownIcon, ChevronUpIcon, FolderIcon, PencilIcon, CalendarIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';
import { ContactSearchSelect } from '../components/ContactSearchSelect';
import { paymentService, Payment } from '../services/paymentService';
import { PaymentModal } from '../components/PaymentModal';
import { deboursNoteService, DeboursNote } from '../services/deboursNoteService';
import { DeboursNoteModal } from '../components/DeboursNoteModal';
import { expensesService, Expense } from '../services/expensesService';
import { ExpenseUploadModal } from '../components/ExpenseUploadModal';
import { OpportunityMetrics } from '../components/OpportunityMetrics';
import { DocumentSection } from '../components/DocumentSection';
import { RevenueTable } from '../components/RevenueTable';
import { Breadcrumb } from '../components/Breadcrumb';

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-100 text-blue-700' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-100 text-purple-700' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-100 text-green-700' },
  FINALIZED: { label: 'Finalisé / réglé', color: 'bg-emerald-100 text-emerald-700' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-100 text-rose-700' }
};

type OpportunityPayload = {
  title: string;
  stage: keyof typeof STAGES;
  amount?: number;
  closeDate?: string;
  expectedPaymentDate?: string;
  taxRate?: number;
  contactId?: string;
  companyId?: string;
};

type OpportunityResponse = OpportunityPayload & { 
  id: string;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
  googleDriveFolderId?: string;
  tiimeQuoteId?: string;
  quoteUrl?: string;
  invoiceUrls?: string[];
};

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const [opportunity, setOpportunity] = useState<OpportunityPayload>({ 
    title: '', 
    stage: 'QUALIFICATION' 
  });
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [driveFolderId, setDriveFolderId] = useState<string | undefined>(undefined);
  const [quoteUrl, setQuoteUrl] = useState<string | undefined>(undefined);
  const [invoiceUrls, setInvoiceUrls] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [taxRate, setTaxRate] = useState<number | undefined>(undefined);
  const [deboursNotes, setDeboursNotes] = useState<DeboursNote[]>([]);
  const [showDeboursNoteModal, setShowDeboursNoteModal] = useState(false);
  const [editingDeboursNote, setEditingDeboursNote] = useState<DeboursNote | undefined>(undefined);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isGeneralInfoCollapsed, setIsGeneralInfoCollapsed] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    void loadContacts();
    void loadCompanies();
    if (!isNew && id) {
      void loadOpportunity(id);
      void loadQuotes(id);
      void loadPayments(id);
      void loadDeboursNotes(id);
      void loadExpenses(id);
    }
  }, [id, isNew]);

  const loadDeboursNotes = async (opportunityId: string) => {
    try {
      const data = await deboursNoteService.getAll({ opportunityId });
      setDeboursNotes(data);
    } catch (error) {
      console.error('Erreur chargement notes de débours:', error);
      setDeboursNotes([]);
    }
  };

  const handleDeleteDeboursNote = async (noteId: string) => {
    try {
      await deboursNoteService.delete(noteId);
      // Recharger les notes de débours et rafraîchir la page
      if (id) {
        await loadDeboursNotes(id);
        await loadPayments(id);
      }
    } catch (error: any) {
      console.error('Erreur suppression note de débours:', error);
      throw error; // Re-lancer pour que RevenueTable puisse afficher l'erreur
    }
  };

  const loadExpenses = async (opportunityId: string) => {
    try {
      console.log('[OPPORTUNITY] Loading expenses for opportunityId:', opportunityId);
      const data = await expensesService.getAll({ opportunityId });
      console.log('[OPPORTUNITY] Expenses loaded:', data);
      setExpenses(data);
    } catch (error) {
      console.error('[OPPORTUNITY] Erreur chargement dépenses:', error);
      setExpenses([]);
    }
  };

  const loadQuotes = async (opportunityId: string) => {
    try {
      const { data } = await api.get('/api/quotes', { params: { opportunityId } });
      setQuotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur chargement devis:', error);
      setQuotes([]);
    }
  };

  const loadPayments = async (opportunityId: string) => {
    try {
      const data = await paymentService.getByOpportunity(opportunityId);
      setPayments(data);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      setPayments([]);
    }
  };

  const loadContacts = async () => {
    try {
      const { data } = await api.get('/api/contacts');
      setContacts(data.items || data.data || []);
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data } = await api.get('/api/companies');
      setCompanies(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  const loadOpportunity = async (opportunityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<OpportunityResponse>(`/api/opportunities/${opportunityId}`);
      
      // Stocker les infos de l'entreprise pour le fil d'Ariane
      if (data.company) {
        setCompanyInfo({ id: data.company.id, name: data.company.name });
      } else if (data.companyId) {
        // Si l'entreprise n'est pas incluse, la charger
        try {
          const { data: companyData } = await api.get(`/api/companies/${data.companyId}`);
          setCompanyInfo({ id: data.companyId, name: companyData.name });
        } catch (err) {
          console.error('Erreur chargement entreprise:', err);
        }
      }
      
      setOpportunity({
        title: data.title,
        stage: data.stage,
        amount: data.amount,
        closeDate: data.closeDate,
        expectedPaymentDate: data.expectedPaymentDate,
        taxRate: data.taxRate ? Number(data.taxRate) : undefined,
        contactId: data.contact?.id,
        companyId: data.company?.id
      });
      setTaxRate(data.taxRate ? Number(data.taxRate) : undefined);
      setDriveFolderId(data.googleDriveFolderId);
      setQuoteUrl(data.quoteUrl);
      setInvoiceUrls(data.invoiceUrls || []);
      console.log('Opportunity loaded:', { googleDriveFolderId: data.googleDriveFolderId, quoteUrl: data.quoteUrl, invoiceUrls: data.invoiceUrls });
    } catch (error) {
      console.error('Erreur chargement opportunité:', error);
    }
    setLoading(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Convertir les dates au format ISO si elles sont au format YYYY-MM-DD
    const formatDateForAPI = (dateStr: string | undefined): string | undefined => {
      if (!dateStr) return undefined;
      // Si c'est déjà au format ISO (contient T), le retourner tel quel
      if (dateStr.includes('T')) return dateStr;
      // Sinon, convertir YYYY-MM-DD en ISO (format attendu par PostgreSQL)
      try {
        return new Date(dateStr + 'T00:00:00').toISOString();
      } catch (e) {
        console.error('Erreur conversion date:', e, dateStr);
        return undefined;
      }
    };
    
    const payload: any = {
      title: opportunity.title,
      stage: opportunity.stage,
    };
    
    // Ajouter les champs optionnels
    if (opportunity.amount !== undefined) payload.amount = opportunity.amount || null;
    if (opportunity.closeDate !== undefined) payload.closeDate = formatDateForAPI(opportunity.closeDate) || null;
    if (opportunity.expectedPaymentDate !== undefined) payload.expectedPaymentDate = formatDateForAPI(opportunity.expectedPaymentDate) || null;
    if (opportunity.taxRate !== undefined) payload.taxRate = opportunity.taxRate || null;
    if (opportunity.contactId !== undefined) payload.contactId = opportunity.contactId || null;
    if (opportunity.companyId !== undefined) payload.companyId = opportunity.companyId || null;
    if (isNew) {
      const { data: newOpportunity } = await api.post('/api/opportunities', payload);
      // Naviguer vers la page de détail de l'opportunité créée pour voir le lien Drive
      if (newOpportunity?.id) {
        navigate(`/opportunites/${newOpportunity.id}`);
      } else {
        navigate('/opportunites');
      }
    } else if (id) {
      try {
        await api.patch(`/api/opportunities/${id}`, payload);
        setError(null);
        // Recharger les données pour avoir les mises à jour (dossiers Drive, devis, etc.)
        await loadOpportunity(id);
        await loadQuotes(id);
        await loadPayments(id);
        await loadDeboursNotes(id);
        await loadExpenses(id);
        // Replier la section informations générales après enregistrement
        setIsGeneralInfoCollapsed(true);
      } catch (err: any) {
        console.error('Erreur mise à jour opportunité:', err);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Erreur lors de la mise à jour';
        setError(errorMessage);
        console.error('Payload envoyé:', payload);
        console.error('Détails erreur:', err.response?.data);
      }
    } else {
      navigate('/opportunites');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette opportunité ?')) {
      return;
    }
    try {
      await api.delete(`/api/opportunities/${id}`);
      navigate('/opportunites');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const refreshAllData = async () => {
    if (!id) return;
    await Promise.all([
      loadOpportunity(id),
      loadQuotes(id),
      loadPayments(id),
      loadDeboursNotes(id),
      loadExpenses(id)
    ]);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Chargement...</div>;
  }

  // Formulaire de création simple pour nouveau client
  if (isNew) {
    return (
      <div className="mx-auto max-w-xl">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-sm text-rose-700">Erreur : {error}</p>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Créer une opportunité</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Titre *</label>
          <input
            value={opportunity.title}
            onChange={(event) => setOpportunity({ ...opportunity, title: event.target.value })}
            required
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Étape</label>
          <select
            value={opportunity.stage}
            onChange={(event) => setOpportunity({ ...opportunity, stage: event.target.value as keyof typeof STAGES })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {Object.entries(STAGES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Montant (€)</label>
          <input
            type="number"
            step="0.01"
            value={opportunity.amount ?? ''}
            onChange={(event) => setOpportunity({ ...opportunity, amount: event.target.value ? parseFloat(event.target.value) : undefined })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Taux de taxe (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={opportunity.taxRate !== undefined ? (opportunity.taxRate * 100) : ''}
            onChange={(event) => setOpportunity({ ...opportunity, taxRate: event.target.value ? parseFloat(event.target.value) / 100 : undefined })}
            placeholder="27"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">Par défaut : 27%</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Date prévisionnelle de facturation</label>
          <input
            type="date"
            value={opportunity.closeDate ? opportunity.closeDate.split('T')[0] : ''}
            onChange={(event) => setOpportunity({ ...opportunity, closeDate: event.target.value || undefined })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Date paiement prévisionnelle</label>
          <input
            type="date"
            value={opportunity.expectedPaymentDate ? opportunity.expectedPaymentDate.split('T')[0] : ''}
            onChange={(event) => setOpportunity({ ...opportunity, expectedPaymentDate: event.target.value || undefined })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Contact</label>
          <ContactSearchSelect
            contacts={contacts}
            selectedContactId={opportunity.contactId}
            defaultCompanyId={opportunity.companyId}
            defaultCompanyName={companies.find(c => c.id === opportunity.companyId)?.name}
            onSelectContact={(contactId) => setOpportunity({ ...opportunity, contactId })}
            onCreateContact={async (firstName, lastName, companyId) => {
              const { data: newContact } = await api.post('/api/contacts', { 
                firstName, 
                lastName: lastName || undefined,
                companyId: companyId || undefined
              });
              setContacts([...contacts, newContact]);
              setOpportunity({ ...opportunity, contactId: newContact.id });
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Client</label>
          <CompanySearchSelect
            companies={companies}
            selectedCompanyId={opportunity.companyId}
            onSelectCompany={(companyId) => setOpportunity({ ...opportunity, companyId })}
            onCreateCompany={async (name) => {
              const { data: newCompany } = await api.post('/api/companies', { name });
              setCompanies([...companies, newCompany]);
              setOpportunity({ ...opportunity, companyId: newCompany.id });
            }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/opportunites')}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Enregistrer
          </button>
        </div>
      </form>
      </div>
    );
  }

  // Page de détail refondue - Version 2025
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Fil d'Ariane */}
      {companyInfo && (
        <Breadcrumb
          items={[
            {
              label: companyInfo.name,
              href: `/entreprises/${companyInfo.id}`
            },
            {
              label: opportunity.title
            }
          ]}
        />
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm text-rose-700">Erreur : {error}</p>
        </div>
      )}

      {/* En-tête modernisé */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">{opportunity.title}</h1>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STAGES[opportunity.stage].color}`}>
              {STAGES[opportunity.stage].label}
            </span>
          </div>
          {opportunity.companyId && (
            <p className="text-base text-slate-600">
              {companies.find(c => c.id === opportunity.companyId)?.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Accès rapide aux documents */}
          {driveFolderId && (
            <a
              href={`https://drive.google.com/drive/folders/${driveFolderId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
            >
              <FolderIcon className="h-5 w-5" />
              Drive
            </a>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <TrashIcon className="h-5 w-5" />
            Supprimer
          </button>
        </div>
      </div>

      {/* Informations générales remontées - Mode compact */}
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {isGeneralInfoCollapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 flex-wrap">
              {opportunity.amount && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">Montant:</span>
                  <span className="text-base font-semibold text-slate-900">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(opportunity.amount)}
                  </span>
                </div>
              )}
              {opportunity.closeDate && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Facturation: {new Date(opportunity.closeDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}
              {opportunity.expectedPaymentDate && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    Paiement: {new Date(opportunity.expectedPaymentDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}
              {opportunity.contactId && (
                <div className="text-sm text-slate-600">
                  Contact: {contacts.find(c => c.id === opportunity.contactId)?.firstName} {contacts.find(c => c.id === opportunity.contactId)?.lastName || ''}
                </div>
              )}
              {opportunity.companyId && (
                <div className="text-sm text-slate-600">
                  {companies.find(c => c.id === opportunity.companyId)?.name}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsGeneralInfoCollapsed(false)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <PencilIcon className="h-4 w-4" />
              Éditer
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Informations générales</h2>
              <button
                type="button"
                onClick={() => setIsGeneralInfoCollapsed(true)}
                className="text-slate-400 hover:text-slate-600"
              >
                <ChevronUpIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titre *</label>
                  <input
                    value={opportunity.title}
                    onChange={(event) => setOpportunity({ ...opportunity, title: event.target.value })}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Étape</label>
                  <select
                    value={opportunity.stage}
                    onChange={(event) => setOpportunity({ ...opportunity, stage: event.target.value as keyof typeof STAGES })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                    value={opportunity.amount ?? ''}
                    onChange={(event) => setOpportunity({ ...opportunity, amount: event.target.value ? parseFloat(event.target.value) : undefined })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Taux de taxe (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={opportunity.taxRate !== undefined ? (opportunity.taxRate * 100) : ''}
                    onChange={(event) => setOpportunity({ ...opportunity, taxRate: event.target.value ? parseFloat(event.target.value) / 100 : undefined })}
                    placeholder="27"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date prévisionnelle de facturation</label>
                  <input
                    type="date"
                    value={opportunity.closeDate ? opportunity.closeDate.split('T')[0] : ''}
                    onChange={(event) => setOpportunity({ ...opportunity, closeDate: event.target.value || undefined })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date paiement prévisionnelle</label>
                  <input
                    type="date"
                    value={opportunity.expectedPaymentDate ? opportunity.expectedPaymentDate.split('T')[0] : ''}
                    onChange={(event) => setOpportunity({ ...opportunity, expectedPaymentDate: event.target.value || undefined })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
                  <ContactSearchSelect
                    contacts={contacts}
                    selectedContactId={opportunity.contactId}
                    defaultCompanyId={opportunity.companyId}
                    defaultCompanyName={companies.find(c => c.id === opportunity.companyId)?.name}
                    onSelectContact={(contactId) => setOpportunity({ ...opportunity, contactId })}
                    onCreateContact={async (firstName, lastName, companyId) => {
                      const { data: newContact } = await api.post('/api/contacts', { 
                        firstName, 
                        lastName: lastName || undefined,
                        companyId: companyId || undefined
                      });
                      setContacts([...contacts, newContact]);
                      setOpportunity({ ...opportunity, contactId: newContact.id });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                  <CompanySearchSelect
                    companies={companies}
                    selectedCompanyId={opportunity.companyId}
                    onSelectCompany={(companyId) => setOpportunity({ ...opportunity, companyId })}
                    onCreateCompany={async (name) => {
                      const { data: newCompany } = await api.post('/api/companies', { name });
                      setCompanies([...companies, newCompany]);
                      setOpportunity({ ...opportunity, companyId: newCompany.id });
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsGeneralInfoCollapsed(true)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Colonne gauche (2/7) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Métriques compactes */}
          <OpportunityMetrics
            opportunityAmount={opportunity.amount}
            invoiceUrls={invoiceUrls}
            expenses={expenses}
            deboursNotes={deboursNotes}
          />

          {/* Documents */}
          <DocumentSection
            driveFolderId={driveFolderId}
            quoteUrl={quoteUrl}
            invoiceUrls={invoiceUrls}
          />
        </div>

        {/* Colonne droite (5/7) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tableau des recettes */}
          <RevenueTable
            quotes={quotes}
            invoiceUrls={invoiceUrls}
            deboursNotes={deboursNotes}
            payments={payments}
            opportunityId={id!}
            opportunityTitle={opportunity.title}
            opportunityAmount={opportunity.amount}
            opportunityTaxRate={taxRate}
            onRefresh={refreshAllData}
            onCreateQuote={() => navigate(`/quotes/new?opportunityId=${id}`)}
            onCreateDeboursNote={() => {
              setEditingDeboursNote(undefined);
              setShowDeboursNoteModal(true);
            }}
            onEditDeboursNote={(note) => {
              setEditingDeboursNote(note);
              setShowDeboursNoteModal(true);
            }}
            onDeleteDeboursNote={handleDeleteDeboursNote}
          />

          {/* Section Dépenses */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Dépenses</h2>
              <button
                type="button"
                onClick={() => setShowExpenseModal(true)}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Ajouter une dépense
              </button>
            </div>
            
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <DocumentDuplicateIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-sm text-slate-500">Aucune dépense liée à cette opportunité</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fournisseur</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Montant TTC</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {expenses.map((expense) => (
                      <tr 
                        key={expense.id} 
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/depenses/${expense.id}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{expense.supplierName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {expense.invoiceDate ? new Date(expense.invoiceDate).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {expense.amountTTC ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(expense.amountTTC.toString())) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            expense.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            expense.status === 'PROCESSED' ? 'bg-blue-100 text-blue-700' :
                            expense.status === 'VERIFIED' ? 'bg-green-100 text-green-700' :
                            expense.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {expense.status === 'PENDING' ? 'En attente' :
                             expense.status === 'PROCESSED' ? 'Traité' :
                             expense.status === 'VERIFIED' ? 'Vérifié' :
                             expense.status === 'PAID' ? 'Réglé' :
                             'Rejeté'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeboursNoteModal && id && (
        <DeboursNoteModal
          isOpen={showDeboursNoteModal}
          onClose={() => {
            setShowDeboursNoteModal(false);
            setEditingDeboursNote(undefined);
          }}
          opportunityId={id}
          opportunityTitle={opportunity.title}
          deboursNote={editingDeboursNote}
          onSuccess={async () => {
            await loadDeboursNotes(id);
            setShowDeboursNoteModal(false);
            setEditingDeboursNote(undefined);
            await refreshAllData();
          }}
        />
      )}

      {showExpenseModal && (
        <ExpenseUploadModal
          onClose={() => {
            setShowExpenseModal(false);
            void refreshAllData();
          }}
          opportunityId={id}
        />
      )}
    </div>
  );
}
