import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TrashIcon, PlusIcon, DocumentTextIcon, BanknotesIcon, ReceiptRefundIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';
import { CompanySearchSelect } from '../components/CompanySearchSelect';
import { ContactSearchSelect } from '../components/ContactSearchSelect';
import { paymentService, Payment } from '../services/paymentService';
import { PaymentModal } from '../components/PaymentModal';
import { deboursNoteService, DeboursNote } from '../services/deboursNoteService';
import { DeboursNoteModal } from '../components/DeboursNoteModal';
import { expensesService, Expense } from '../services/expensesService';
import { ExpenseUploadModal } from '../components/ExpenseUploadModal';

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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'quotes' | 'debours' | 'payments' | 'expenses' | 'documents'>('overview');

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

  // Page de détail avec onglets pour opportunité existante
  return (
    <div className="mx-auto max-w-7xl">
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm text-rose-700">Erreur : {error}</p>
        </div>
      )}

      {/* En-tête */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{opportunity.title}</h1>
          {opportunity.companyId && (
            <p className="mt-1 text-sm text-slate-500">
              {companies.find(c => c.id === opportunity.companyId)?.name}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <TrashIcon className="h-5 w-5" />
          Supprimer
        </button>
      </div>

      {/* Onglets */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab('quotes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'quotes'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <DocumentTextIcon className="w-5 h-5 inline mr-2" />
            Devis & Factures
          </button>
          <button
            onClick={() => setActiveTab('debours')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'debours'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ReceiptRefundIcon className="w-5 h-5 inline mr-2" />
            Notes de débours
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'expenses'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <DocumentDuplicateIcon className="w-5 h-5 inline mr-2" />
            Dépenses
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'payments'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <BanknotesIcon className="w-5 h-5 inline mr-2" />
            Paiements
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'documents'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Documents
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="space-y-6">
        {/* Onglet Vue d'ensemble */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Informations générales</h2>
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
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/opportunites')}
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

        {/* Onglet Devis & Factures */}
        {activeTab === 'quotes' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Devis</h2>
                <button
                  type="button"
                  onClick={() => navigate(`/quotes/new?opportunityId=${id}`)}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  Créer un devis
                </button>
              </div>
              
              {quotes.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentTextIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-sm text-slate-500">Aucun devis pour cette opportunité</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="group rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => navigate(`/quotes/${quote.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-slate-900">{quote.label}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          quote.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                          quote.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                          quote.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                          quote.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {quote.status === 'DRAFT' ? 'Brouillon' :
                           quote.status === 'SENT' ? 'Envoyé' :
                           quote.status === 'ACCEPTED' ? 'Accepté' :
                           quote.status === 'REJECTED' ? 'Refusé' :
                           'Expiré'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        {quote.quoteNumber && <div>N° {quote.quoteNumber}</div>}
                        {quote.totalTTC && (
                          <div className="font-semibold text-slate-900">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(quote.totalTTC))} TTC
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section Factures (préparée pour Tiime) */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Factures</h2>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                >
                  <PlusIcon className="w-5 h-5" />
                  Importer depuis Tiime (bientôt)
                </button>
              </div>
              {invoiceUrls && invoiceUrls.length > 0 ? (
                <div className="space-y-2">
                  {invoiceUrls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-amber-600">🧾</span>
                      <span className="text-sm font-medium text-slate-900">Facture {index + 1}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-slate-500">Aucune facture importée</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Onglet Notes de débours */}
        {activeTab === 'debours' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Notes de débours</h2>
              <button
                type="button"
                onClick={() => setShowDeboursNoteModal(true)}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Créer une note de débours
              </button>
            </div>
            
            {deboursNotes.length === 0 ? (
              <div className="text-center py-12">
                <ReceiptRefundIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-sm text-slate-500">Aucune note de débours pour cette opportunité</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deboursNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">{note.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(note.totalAmount)} TTC
                          </span>
                          {note.expectedPaymentDate && (
                            <span>
                              Paiement prévu : {new Date(note.expectedPaymentDate).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        note.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                        note.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {note.status === 'DRAFT' ? 'Brouillon' :
                         note.status === 'SENT' ? 'Envoyée' :
                         'Payée'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      {note.googleDocUrl && (
                        <a
                          href={note.googleDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          📄 Voir le document
                        </a>
                      )}
                      {note.status !== 'PAID' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowPaymentModal(true);
                            // TODO: Passer deboursNoteId au modal
                          }}
                          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Marquer comme payé
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onglet Dépenses */}
        {activeTab === 'expenses' && (
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
                            'bg-red-100 text-red-700'
                          }`}>
                            {expense.status === 'PENDING' ? 'En attente' :
                             expense.status === 'PROCESSED' ? 'Traité' :
                             expense.status === 'VERIFIED' ? 'Vérifié' :
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
        )}

        {/* Onglet Paiements */}
        {activeTab === 'payments' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Paiements</h2>
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Ajouter un paiement
              </button>
            </div>
            
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <BanknotesIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-sm text-slate-500">Aucun paiement enregistré</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-semibold text-slate-900">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payment.amount)}
                          </span>
                          {payment.deboursNoteId && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              Note de débours
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          <div>Payé le {new Date(payment.paymentDate).toLocaleDateString('fr-FR')}</div>
                          {payment.taxAmount > 0 && (
                            <div>Taxes : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payment.taxAmount)}</div>
                          )}
                          {payment.notes && (
                            <div className="text-xs text-slate-400 mt-1">{payment.notes}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onglet Documents */}
        {activeTab === 'documents' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Documents</h2>
            <div className="flex flex-wrap gap-3">
              {driveFolderId ? (
                <a
                  href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  <span>📂</span>
                  Dossier Drive
                </a>
              ) : (
                <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <span>📂</span>
                  Dossier Drive (création en cours...)
                </span>
              )}
              {quoteUrl && (
                <a
                  href={quoteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <span>📄</span>
                  Dernier devis
                </a>
              )}
              {invoiceUrls && invoiceUrls.length > 0 && (
                <a
                  href={invoiceUrls[invoiceUrls.length - 1]}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <span>🧾</span>
                  Dernière facture
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          opportunityId={id}
          opportunityTitle={opportunity.title}
          opportunityAmount={opportunity.amount}
          opportunityTaxRate={taxRate}
          onSuccess={async () => {
            await loadPayments(id!);
            setShowPaymentModal(false);
          }}
        />
      )}

      {showDeboursNoteModal && id && (
        <DeboursNoteModal
          isOpen={showDeboursNoteModal}
          onClose={() => setShowDeboursNoteModal(false)}
          opportunityId={id}
          opportunityTitle={opportunity.title}
          onSuccess={async () => {
            await loadDeboursNotes(id);
            setShowDeboursNoteModal(false);
          }}
        />
      )}

      {showExpenseModal && (
        <ExpenseUploadModal
          onClose={() => setShowExpenseModal(false)}
          opportunityId={id}
        />
      )}
    </div>
  );
}

