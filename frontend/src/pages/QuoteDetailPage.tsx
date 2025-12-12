import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TrashIcon } from '@heroicons/react/24/outline';
import api from '../services/apiClient';
import { QuoteForm } from '../components/QuoteForm';
import { Breadcrumb, BreadcrumbItem } from '../components/Breadcrumb';

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
  const [deleting, setDeleting] = useState(false);
  const [opportunityInfo, setOpportunityInfo] = useState<{ id: string; title: string; companyId?: string; companyName?: string } | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; name: string } | null>(null);

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
    setLoading(true);
    try {
      console.log('[QuoteDetailPage] Chargement opportunité pour pré-remplissage:', oppId);
      const { data: opportunity } = await api.get(`/api/opportunities/${oppId}`);
      console.log('[QuoteDetailPage] Opportunité chargée:', opportunity);
      
      // Stocker les infos pour le fil d'Ariane
      setOpportunityInfo({
        id: oppId,
        title: opportunity.title,
        companyId: opportunity.company?.id || opportunity.companyId,
        companyName: opportunity.company?.name
      });
      
      if (opportunity.company?.id || opportunity.companyId) {
        const compId = opportunity.company?.id || opportunity.companyId;
        if (opportunity.company?.name) {
          setCompanyInfo({ id: compId, name: opportunity.company.name });
        } else if (compId) {
          try {
            const { data: companyData } = await api.get(`/api/companies/${compId}`);
            setCompanyInfo({ id: compId, name: companyData.name });
          } catch (err) {
            console.error('Erreur chargement entreprise:', err);
          }
        }
      }
      
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
      
      console.log('[QuoteDetailPage] Devis pré-rempli créé:', prefillQuote);
      setQuote(prefillQuote);
    } catch (err: any) {
      console.error('[QuoteDetailPage] Erreur chargement opportunité pour pré-remplissage:', err);
      // Ne pas bloquer, créer un devis vide
      const emptyQuote: Quote = {
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
      };
      setQuote(emptyQuote);
    } finally {
      setLoading(false);
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
      
      // Charger les informations d'opportunité et d'entreprise pour le fil d'Ariane
      if (data.opportunityId || data.opportunity?.id) {
        const oppId = data.opportunityId || data.opportunity?.id;
        if (oppId) {
          try {
            const { data: oppData } = await api.get(`/api/opportunities/${oppId}`);
            setOpportunityInfo({
              id: oppId,
              title: oppData.title,
              companyId: oppData.company?.id || oppData.companyId,
              companyName: oppData.company?.name
            });
            
            // Charger l'entreprise si on a l'ID mais pas le nom
            const companyIdToLoad = oppData.company?.id || oppData.companyId || data.companyId;
            if (companyIdToLoad && !oppData.company?.name) {
              try {
                const { data: companyData } = await api.get(`/api/companies/${companyIdToLoad}`);
                setCompanyInfo({ id: companyIdToLoad, name: companyData.name });
              } catch (err) {
                console.error('Erreur chargement entreprise:', err);
              }
            } else if (oppData.company?.name) {
              setCompanyInfo({ id: companyIdToLoad, name: oppData.company.name });
            }
          } catch (err) {
            console.error('Erreur chargement opportunité:', err);
          }
        }
      } else if (data.companyId || data.company?.id) {
        // Si pas d'opportunité mais une entreprise
        const compId = data.companyId || data.company?.id;
        if (compId) {
          try {
            const { data: companyData } = await api.get(`/api/companies/${compId}`);
            setCompanyInfo({ id: compId, name: companyData.name });
          } catch (err) {
            console.error('Erreur chargement entreprise:', err);
          }
        }
      }
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

  const handleDelete = async () => {
    if (!id || isNew) return;
    
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce devis ? Cette action est irréversible.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/quotes/${id}`);
      // Rediriger vers l'opportunité si on venait d'une opportunité
      if (opportunityId) {
        navigate(`/opportunites/${opportunityId}`);
      } else {
        navigate('/opportunites');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression du devis');
      setDeleting(false);
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

  // Construire le fil d'Ariane
  const buildBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    
    const currentOpportunityId = opportunityId || opportunityInfo?.id;
    const currentCompanyId = companyId || opportunityInfo?.companyId || quote?.companyId;
    const currentCompanyName = companyInfo?.name || opportunityInfo?.companyName;
    const currentOpportunityTitle = opportunityInfo?.title;
    
    // Entreprise
    if (currentCompanyId && currentCompanyName) {
      items.push({
        label: currentCompanyName,
        href: `/entreprises/${currentCompanyId}`
      });
    }
    
    // Opportunité
    if (currentOpportunityId && currentOpportunityTitle) {
      items.push({
        label: currentOpportunityTitle,
        href: `/opportunites/${currentOpportunityId}`
      });
    }
    
    // Devis (page courante)
    items.push({
      label: isNew ? 'Créer un devis' : (quote?.label || 'Modifier le devis')
    });
    
    return items;
  };

  const breadcrumbItems = buildBreadcrumbItems();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Fil d'Ariane */}
        {breadcrumbItems.length > 1 && (
          <Breadcrumb items={breadcrumbItems} className="mb-4" />
        )}
        
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            {isNew ? 'Créer un devis' : 'Modifier le devis'}
          </h1>
          {!isNew && id && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
              {deleting ? 'Suppression...' : 'Supprimer le devis'}
            </button>
          )}
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

