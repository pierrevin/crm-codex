import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PencilIcon, TrashIcon, ArrowLeftIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { expensesService, Expense, ExpenseStatus, UpdateExpenseDto } from '../services/expensesService';
import { AccountCodeSelector } from '../components/AccountCodeSelector';

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSED: 'bg-blue-100 text-blue-700',
  VERIFIED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700'
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

  useEffect(() => {
    if (id) {
      void loadExpense(id);
    }
  }, [id]);

  const loadExpense = async (expenseId: string) => {
    setLoading(true);
    try {
      const data = await expensesService.getById(expenseId);
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
        notes: notes || undefined
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

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const getExpenseTitle = (expense: Expense): string => {
    // Si on a un numéro de facture et un fournisseur
    if (expense.invoiceNumber && expense.supplierName) {
      return `Facture ${expense.invoiceNumber} - ${expense.supplierName}`;
    }
    
    // Si on a un numéro de facture
    if (expense.invoiceNumber) {
      return `Facture ${expense.invoiceNumber}`;
    }
    
    // Si on a un fournisseur
    if (expense.supplierName) {
      const date = expense.invoiceDate 
        ? formatDate(expense.invoiceDate)
        : formatDate(expense.createdAt);
      return `${expense.supplierName} - ${date}`;
    }
    
    // Si on a une entreprise liée
    if (expense.company?.name) {
      const date = expense.invoiceDate 
        ? formatDate(expense.invoiceDate)
        : formatDate(expense.createdAt);
      return `${expense.company.name} - ${date}`;
    }
    
    // Par défaut : date de création
    return `Dépense du ${formatDate(expense.createdAt)}`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">Chargement...</div>
    );
  }

  if (!expense) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Dépense non trouvée</p>
        <button
          onClick={() => navigate('/depenses')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/depenses')}
            className="text-slate-600 hover:text-slate-900"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {getExpenseTitle(expense)}
            </h1>
            <p className="text-sm text-slate-500">
              {expense.invoiceDate 
                ? `Facture du ${formatDate(expense.invoiceDate)}`
                : `Créée le ${formatDate(expense.createdAt)}`
              }
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckIcon className="w-5 h-5" />
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  void loadExpense(expense.id);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                <XMarkIcon className="w-5 h-5" />
                Annuler
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <PencilIcon className="w-5 h-5" />
                Modifier
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <TrashIcon className="w-5 h-5" />
                Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations principales */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Informations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fournisseur
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-900">{expense.supplierName || expense.company?.name || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Numéro de facture
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-900">{expense.invoiceNumber || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date de facture
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-900">{formatDate(expense.invoiceDate)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Statut
                </label>
                {isEditing ? (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[expense.status]}`}>
                    {STATUS_LABELS[expense.status]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Montants */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Montants</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Montant HT
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={amountHT}
                    onChange={(e) => setAmountHT(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-900 font-medium">{formatCurrency(expense.amountHT)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  TVA
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-900">{formatCurrency(expense.vatAmount)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Taux TVA (%)
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-900">
                    {expense.vatRate ? (Number(expense.vatRate) * 100).toFixed(2) + '%' : '-'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Montant TTC
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={amountTTC}
                    onChange={(e) => setAmountTTC(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                ) : (
                  <p className="text-slate-900 font-semibold text-lg">{formatCurrency(expense.amountTTC)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Comptabilité */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Comptabilité</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
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
                  <>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Code compte
                    </label>
                    <p className="text-slate-900">
                      {expense.accountCode || '-'}
                      {expense.accountLabel && (
                        <span className="ml-2 text-slate-600 text-sm">({expense.accountLabel})</span>
                      )}
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Libellé compte
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={accountLabel}
                    onChange={(e) => setAccountLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    placeholder="Libellé du compte"
                  />
                ) : (
                  <p className="text-slate-900">{expense.accountLabel || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
            {isEditing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                placeholder="Ajoutez des notes..."
              />
            ) : (
              <p className="text-slate-900 whitespace-pre-wrap">{expense.notes || 'Aucune note'}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Aperçu du document */}
          {expense.fileUrl && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Document</h2>
              <div className="space-y-3">
                <p className="text-sm text-slate-600">{expense.fileName || 'Fichier'}</p>
                
                {/* Aperçu selon le type de fichier */}
                {expense.fileType?.startsWith('image/') ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden cursor-pointer group relative" onClick={() => setShowImageZoom(true)}>
                    <img
                      src={expense.fileUrl}
                      alt="Aperçu facture"
                      className="w-full h-auto max-h-96 object-contain transition-transform group-hover:scale-105"
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
                      className="w-full h-96"
                      title="Aperçu PDF"
                    />
                  </div>
                ) : null}
                
                <a
                  href={expense.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm w-full justify-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ouvrir dans un nouvel onglet
                </a>
              </div>
            </div>
          )}

          {/* Métadonnées */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Informations système</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-slate-500">Créée le:</span>
                <p className="text-slate-900">{formatDate(expense.createdAt)}</p>
              </div>
              <div>
                <span className="text-slate-500">Modifiée le:</span>
                <p className="text-slate-900">{formatDate(expense.updatedAt)}</p>
              </div>
              {expense.user && (
                <div>
                  <span className="text-slate-500">Créée par:</span>
                  <p className="text-slate-900">{expense.user.email}</p>
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

