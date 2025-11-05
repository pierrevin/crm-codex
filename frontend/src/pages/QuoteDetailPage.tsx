import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/apiClient';
import { QuoteForm } from '../components/QuoteForm';

type Quote = {
  id?: string;
  label: string;
  quoteNumber?: string;
  issueDate: string;
  validityEndDate?: string;
  freeField?: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  opportunityId?: string;
  companyId?: string;
  items: Array<{
    id?: string;
    label: string;
    description?: string;
    quantity: number;
    unit: string;
    unitPriceHT: number;
    discountAmount?: number;
    taxRate: number;
    vatExemptionReason?: string;
    totalHT?: number;
    order: number;
  }>;
};

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const [loading, setLoading] = useState(!isNew);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const opportunityId = searchParams.get('opportunityId');
  const companyId = searchParams.get('companyId');

  useEffect(() => {
    if (!isNew && id) {
      void loadQuote(id);
    } else if (isNew && opportunityId) {
      // Pré-remplir le formulaire avec les données de l'opportunité
      void loadOpportunityForPrefill(opportunityId);
    } else if (isNew && !opportunityId) {
      // Initialiser avec un devis vide
      const emptyQuote: Quote = {
        label: '',
        issueDate: new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        companyId: companyId || undefined,
        items: [{
          label: '',
          quantity: 1,
          unit: 'heures',
          unitPriceHT: 0,
          taxRate: 0,
          order: 0
        }]
      };
      setQuote(emptyQuote);
    }
  }, [id, isNew, opportunityId, companyId]);

  const loadOpportunityForPrefill = async (oppId: string) => {
    try {
      const { data: opportunity } = await api.get(`/api/opportunities/${oppId}`);
      
      // Calculer la date de validité (30 jours par défaut)
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + 30);
      
      // Créer un devis pré-rempli avec les données de l'opportunité
      const prefillQuote: Quote = {
        label: `Devis - ${opportunity.title}`,
        issueDate: new Date().toISOString().split('T')[0],
        validityEndDate: validityDate.toISOString().split('T')[0],
        status: 'DRAFT',
        opportunityId: oppId,
        companyId: opportunity.company?.id || opportunity.companyId,
        items: [{
          label: opportunity.title || 'Prestation',
          description: `Devis pour l'opportunité: ${opportunity.title}`,
          quantity: 1,
          unit: 'forfait',
          unitPriceHT: opportunity.amount || 0,
          taxRate: 0,
          order: 0
        }]
      };
      
      setQuote(prefillQuote);
    } catch (err: any) {
      console.error('Erreur chargement opportunité pour pré-remplissage:', err);
      // Ne pas bloquer, créer un devis vide
      setQuote({
        label: '',
        issueDate: new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        opportunityId: oppId,
        companyId: companyId || undefined,
        items: [{
          label: '',
          quantity: 1,
          unit: 'heures',
          unitPriceHT: 0,
          taxRate: 0,
          order: 0
        }]
      });
    }
  };

  const loadQuote = async (quoteId: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/quotes/${quoteId}`);
      
      // Convertir les Decimal en number pour le formulaire
      const quoteData: Quote = {
        ...data,
        issueDate: data.issueDate ? new Date(data.issueDate).toISOString().split('T')[0] : '',
        validityEndDate: data.validityEndDate ? new Date(data.validityEndDate).toISOString().split('T')[0] : '',
        items: (data.items || []).map((item: any) => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          unitPriceHT: parseFloat(item.unitPriceHT) || 0,
          discountAmount: item.discountAmount ? parseFloat(item.discountAmount) : undefined,
          taxRate: parseFloat(item.taxRate) || 0,
          totalHT: item.totalHT ? parseFloat(item.totalHT) : 0,
          order: item.order || 0
        }))
      };
      
      setQuote(quoteData);
    } catch (err: any) {
      console.error('Erreur chargement devis:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement du devis');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (quoteData: Quote) => {
    try {
      setError(null);
      
      // Préparer les données pour l'API
      const payload = {
        ...quoteData,
        issueDate: new Date(quoteData.issueDate).toISOString(),
        validityEndDate: quoteData.validityEndDate ? new Date(quoteData.validityEndDate).toISOString() : undefined,
        items: quoteData.items.map(item => ({
          ...item,
          quantity: item.quantity,
          unitPriceHT: item.unitPriceHT,
          discountAmount: item.discountAmount,
          taxRate: item.taxRate
        }))
      };

      if (isNew) {
        const { data } = await api.post('/api/quotes', payload);
        navigate(`/quotes/${data.id}`, { replace: true });
      } else {
        await api.patch(`/api/quotes/${id}`, payload);
        navigate(`/quotes/${id}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Erreur sauvegarde devis:', err);
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde du devis');
    }
  };

  const handleCancel = () => {
    if (opportunityId) {
      navigate(`/opportunites/${opportunityId}`);
    } else if (companyId) {
      navigate(`/entreprises/${companyId}`);
    } else {
      navigate('/opportunites');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-8 text-slate-500">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {isNew ? 'Créer un devis' : 'Modifier le devis'}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <QuoteForm
          quote={quote || undefined}
          opportunityId={opportunityId || undefined}
          companyId={companyId || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

