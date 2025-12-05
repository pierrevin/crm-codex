import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  PencilIcon, 
  TrashIcon, 
  ArrowLeftIcon, 
  CheckIcon, 
  XMarkIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CurrencyEuroIcon,
  InformationCircleIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import { expensesService, Expense, ExpenseStatus, UpdateExpenseDto } from '../services/expensesService';
import { recurringExpensesService, RecurringExpense } from '../services/recurringExpensesService';
import { AccountCodeSelector } from '../components/AccountCodeSelector';
import api from '../services/apiClient';

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  PROCESSED: 'bg-blue-100 text-blue-700 border-blue-200',
  VERIFIED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200'
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'En attente',
  PROCESSED: 'Traité',
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté'
};

export function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  
  // Champs éditables
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [amountHT, setAmountHT] = useState('');
  const [amountTTC, setAmountTTC] = useState('');
  const [vatAmount, setVatAmount] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('PENDING');
  const [notes, setNotes] = useState('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<any[]>([]);
  
  // État pour afficher les infos de récurrence (lecture seule)
  const [recurringExpense, setRecurringExpense] = useState<RecurringExpense | null>(null);

  useEffect(() => {
    if (id) {
      void loadExpense(id);
    }
    void loadOpportunities();
  }, [id]);

  const loadOpportunities = async () => {
    try {
      const { data } = await api.get('/api/opportunities?limit=1000');
      setOpportunities(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (error) {
      console.error('Erreur chargement opportunités:', error);
    }
  };

  const loadExpense = async (expenseId: string) => {
    setLoading(true);
    try {
      const data = await expensesService.getById(expenseId);
      console.log('[EXPENSE DETAIL] Loaded expense:', data);
      console.log('[EXPENSE DETAIL] Opportunity:', data.opportunity);
      console.log('[EXPENSE DETAIL] OpportunityId:', data.opportunityId);
      setExpense(data);
      // Initialiser les champs éditables
      setSupplierName(data.supplierName || '');
      setInvoiceNumber(data.invoiceNumber || '');
      setInvoiceDate(data.invoiceDate ? data.invoiceDate.split('T')[0] : '');
      setAmountHT(data.amountHT?.toString() || '');
      setAmountTTC(data.amountTTC?.toString() || '');
      setVatAmount(data.vatAmount?.toString() || '');
      setVatRate(data.vatRate ? (Number(data.vatRate) * 100).toFixed(2) : '');
      setAccountCode(data.accountCode || '');
      setAccountLabel(data.accountLabel || '');
      setStatus(data.status);
      setNotes(data.notes || '');
      setSelectedOpportunityId(data.opportunityId || '');
      
      // Charger les informations de récurrence si la dépense est liée à un modèle récurrent (lecture seule)
      if (data.recurringExpenseId) {
        try {
          const recurring = await recurringExpensesService.getById(data.recurringExpenseId);
          setRecurringExpense(recurring);
        } catch (error) {
          console.error('Erreur chargement dépense récurrente:', error);
        }
      } else {
        setRecurringExpense(null);
      }
    } catch (error) {
      console.error('Erreur chargement dépense:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!expense) return;

    setSaving(true);
    try {
      const updateData: UpdateExpenseDto = {
        supplierName: supplierName || undefined,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: invoiceDate || undefined,
        amountHT: amountHT ? parseFloat(amountHT) : undefined,
        amountTTC: amountTTC ? parseFloat(amountTTC) : undefined,
        vatAmount: vatAmount ? parseFloat(vatAmount) : undefined,
        vatRate: vatRate ? parseFloat(vatRate) / 100 : undefined,
        accountCode: accountCode || undefined,
        accountLabel: accountLabel || undefined,
        status,
        notes: notes || undefined,
        opportunityId: selectedOpportunityId || undefined
      };

      await expensesService.update(expense.id, updateData);
      
      setIsEditing(false);
      await loadExpense(expense.id);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      return;
    }

    try {
      await expensesService.delete(expense.id);
      navigate('/depenses');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleValidateForecast = async () => {
    if (!expense) return;
    try {
      await expensesService.validateForecast(expense.id);
      await loadExpense(expense.id);
    } catch (error) {
      console.error('Erreur validation:', error);
      alert('Erreur lors de la validation');
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getExpenseTitle = (expense: Expense): string => {
    if (expense.invoiceNumber && expense.supplierName) {
      return `Facture ${expense.invoiceNumber}`;
    }
    if (expense.invoiceNumber) {
      return `Facture ${expense.invoiceNumber}`;
    }
    if (expense.supplierName) {
      return expense.supplierName;
    }
    if (expense.company?.name) {
      return expense.company.name;
    }
    return 'Dépense';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Dépense non trouvée</p>
          <button
            onClick={() => navigate('/depenses')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête avec statut en évidence */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/depenses')}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-3">
                  {getExpenseTitle(expense)}
                </h1>
                {expense.invoiceDate && (
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    <span className="text-lg font-semibold text-slate-900">
                      {formatDate(expense.invoiceDate)}
                    </span>
                  </div>
                )}
                {/* Afficher le fournisseur seulement s'il n'est pas déjà dans le titre */}
                {expense.supplierName && getExpenseTitle(expense) !== expense.supplierName && (
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <BuildingOfficeIcon className="w-4 h-4" />
                    <span>{expense.supplierName}</span>
                  </div>
                )}
                {/* Afficher l'entreprise si elle est différente du fournisseur et du titre */}
                {expense.company?.name && 
                 getExpenseTitle(expense) !== expense.company.name && 
                 expense.supplierName !== expense.company.name && (
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <BuildingOfficeIcon className="w-4 h-4" />
                    <span>{expense.company.name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${STATUS_COLORS[expense.status]}`}>
                  {STATUS_LABELS[expense.status]}
                </span>
                {expense.isForecast && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border bg-purple-100 text-purple-700 border-purple-200">
                    Prévisionnel
                  </span>
                )}
              </div>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    <CheckIcon className="w-5 h-5" />
                    Enregistrer
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      void loadExpense(expense.id);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                  >
                    <XMarkIcon className="w-5 h-5" />
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  {expense.isForecast && (
                    <button
                      onClick={handleValidateForecast}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <CheckIcon className="w-5 h-5" />
                      Vérifier
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // Initialiser les champs de récurrence si nécessaire
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    <PencilIcon className="w-5 h-5" />
                    Modifier
                  </button>
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <TrashIcon className="w-5 h-5" />
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Montant principal en évidence */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Montant TTC</p>
                  <p className="text-4xl font-bold text-slate-900">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={amountTTC}
                        onChange={(e) => setAmountTTC(e.target.value)}
                        className="bg-white/80 border border-blue-300 rounded-lg px-4 py-2 text-3xl font-bold w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      formatCurrency(expense.amountTTC)
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600 mb-1">HT</p>
                  <p className="text-xl font-semibold text-slate-700">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={amountHT}
                        onChange={(e) => setAmountHT(e.target.value)}
                        className="bg-white/80 border border-blue-300 rounded-lg px-3 py-1.5 text-lg font-semibold w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      formatCurrency(expense.amountHT)
                    )}
                  </p>
                </div>
              </div>
              {!isEditing && expense.vatAmount && Number(expense.vatAmount) > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between text-sm">
                  <span className="text-slate-600">TVA</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(expense.vatAmount)} ({expense.vatRate ? (Number(expense.vatRate) * 100).toFixed(2) : '0'}%)
                  </span>
                </div>
              )}
            </div>

            {/* Informations principales */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-slate-400" />
                Informations
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fournisseur
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-slate-900 font-medium">{expense.supplierName || expense.company?.name || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Numéro de facture
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-slate-900 font-medium">{expense.invoiceNumber || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Date de facture
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-slate-900">{formatDate(expense.invoiceDate)}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Opportunité
                  </label>
                  {isEditing ? (
                    <select
                      value={selectedOpportunityId}
                      onChange={(e) => setSelectedOpportunityId(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Aucune</option>
                      {opportunities.map(opp => {
                        const companyName = opp.company?.name || '';
                        const displayText = companyName 
                          ? `${opp.title} - ${companyName}`
                          : opp.title;
                        return (
                          <option key={opp.id} value={opp.id}>{displayText}</option>
                        );
                      })}
                    </select>
                  ) : (
                    (expense.opportunity || expense.opportunityId) ? (
                      <button
                        onClick={() => {
                          const oppId = expense.opportunity?.id || expense.opportunityId;
                          console.log('[EXPENSE DETAIL] Navigating to opportunity:', oppId);
                          if (oppId) {
                            navigate(`/opportunites/${oppId}`);
                          } else {
                            console.error('[EXPENSE DETAIL] No opportunity ID found:', { 
                              opportunity: expense.opportunity, 
                              opportunityId: expense.opportunityId 
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        <LinkIcon className="w-4 h-4" />
                        {expense.opportunity?.title || 'Voir l\'opportunité'}
                      </button>
                    ) : (
                      <p className="text-slate-400">Aucune opportunité liée</p>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Détails financiers */}
            {isEditing && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                  <CurrencyEuroIcon className="w-5 h-5 text-slate-400" />
                  Détails financiers
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Montant HT
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountHT}
                      onChange={(e) => setAmountHT(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Montant TVA
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={vatAmount}
                      onChange={(e) => setVatAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Taux TVA (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={vatRate}
                      onChange={(e) => setVatRate(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Statut
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}


            {/* Notes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
              {isEditing ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ajoutez des notes..."
                />
              ) : (
                <p className="text-slate-900 whitespace-pre-wrap">{expense.notes || <span className="text-slate-400">Aucune note</span>}</p>
              )}
            </div>

            {/* Info dépense récurrente (lecture seule) */}
            {expense.recurringExpenseId && recurringExpense && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Dépense récurrente</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      Générée depuis un modèle récurrent
                    </span>
                    <span className={`text-xs font-medium ${
                      recurringExpense.isActive ? 'text-green-700' : 'text-slate-500'
                    }`}>
                      {recurringExpense.isActive ? '• Modèle actif' : '• Modèle inactif'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Type:</span>
                      <span className="ml-2 font-medium text-slate-900">
                        {recurringExpense.recurrenceType === 'MONTHLY' ? 'Mensuelle' :
                         recurringExpense.recurrenceType === 'WEEKLY' ? 'Hebdomadaire' :
                         recurringExpense.recurrenceType === 'QUARTERLY' ? 'Trimestrielle' :
                         recurringExpense.recurrenceType === 'YEARLY' ? 'Annuelle' : recurringExpense.recurrenceType}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Jour de paiement:</span>
                      <span className="ml-2 font-medium text-slate-900">{recurringExpense.paymentDay}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Pour modifier le modèle récurrent, allez dans la page Dépenses → Section "Dépenses récurrentes"
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Comptabilité */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CurrencyEuroIcon className="w-5 h-5 text-slate-400" />
                Comptabilité
              </h2>
              <div className="space-y-3">
                {isEditing ? (
                  <AccountCodeSelector
                    value={accountCode}
                    onChange={(code, label) => {
                      setAccountCode(code);
                      setAccountLabel(label);
                    }}
                    label="Code compte"
                    required
                  />
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Code compte
                    </label>
                    <p className="text-slate-900 font-medium text-lg">
                      {expense.accountCode || '-'}
                      {expense.accountLabel && (
                        <span className="ml-2 text-slate-600 font-normal text-base">({expense.accountLabel})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Document */}
            {expense.fileUrl && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Document</h2>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">{expense.fileName || 'Fichier'}</p>
                  
                  {expense.fileType?.startsWith('image/') ? (
                    <div 
                      className="border border-slate-200 rounded-lg overflow-hidden cursor-pointer group relative"
                      onClick={() => setShowImageZoom(true)}
                    >
                      <img
                        src={expense.fileUrl}
                        alt="Aperçu facture"
                        className="w-full h-auto max-h-64 object-contain transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  ) : expense.fileType === 'application/pdf' ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <iframe
                        src={expense.fileUrl}
                        className="w-full h-64"
                        title="Aperçu PDF"
                      />
                    </div>
                  ) : null}
                  
                  <a
                    href={expense.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Ouvrir dans un nouvel onglet
                  </a>
                </div>
              </div>
            )}

            {/* Informations système - Compact et pliable */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowSystemInfo(!showSystemInfo)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Informations système</span>
                </div>
                <svg 
                  className={`w-5 h-5 text-slate-400 transition-transform ${showSystemInfo ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSystemInfo && (
                <div className="px-6 py-4 border-t border-slate-200 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Créée le</span>
                    <span className="text-slate-900 font-medium">{formatDate(expense.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Modifiée le</span>
                    <span className="text-slate-900 font-medium">{formatDate(expense.updatedAt)}</span>
                  </div>
                  {expense.user && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Créée par</span>
                      <span className="text-slate-900 font-medium">{expense.user.email}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de zoom pour les images */}
      {showImageZoom && expense.fileUrl && expense.fileType?.startsWith('image/') && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageZoom(false)}
        >
          <button
            onClick={() => setShowImageZoom(false)}
            className="absolute top-4 right-4 text-white hover:text-slate-300 z-10"
          >
            <XMarkIcon className="w-8 h-8" />
          </button>
          <img
            src={expense.fileUrl}
            alt="Aperçu facture agrandi"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
