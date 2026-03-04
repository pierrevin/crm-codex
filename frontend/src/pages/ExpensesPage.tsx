import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, CheckIcon, PencilIcon, TrashIcon, XMarkIcon, ChevronUpIcon, ChevronDownIcon, EyeIcon } from '@heroicons/react/24/outline';
import { expensesService, Expense, ExpenseStatus, ExpenseFilters, UpdateExpenseDto } from '../services/expensesService';
import { recurringExpensesService, RecurringExpense, RecurrenceType, UpdateRecurringExpenseDto } from '../services/recurringExpensesService';
import { ExpenseUploadModal } from '../components/ExpenseUploadModal';
import { RecurringExpenseEditForm } from '../components/RecurringExpenseEditForm';
import { AccountCodeSelector } from '../components/AccountCodeSelector';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'En attente',
  PROCESSED: 'En attente',
  VERIFIED: 'Vérifié',
  PAID: 'Réglé',
  REJECTED: 'Rejeté'
};

// Statuts proposés à l'utilisateur dans les listes déroulantes
const DISPLAY_STATUSES: ExpenseStatus[] = ['PENDING', 'VERIFIED', 'PAID', 'REJECTED'];

const STATUS_TO_BADGE_VARIANT: Record<ExpenseStatus, 'pending' | 'processed' | 'verified' | 'paid' | 'rejected'> = {
  PENDING: 'pending',
  PROCESSED: 'pending',
  VERIFIED: 'verified',
  PAID: 'paid',
  REJECTED: 'rejected'
};

type SortField = 'invoiceDate' | 'supplierName' | 'invoiceNumber' | 'amountHT' | 'vatAmount' | 'amountTTC' | 'accountCode' | 'status';
type SortDirection = 'asc' | 'desc';

interface ColumnFilter {
  supplierName?: string;
  invoiceNumber?: string;
  amountHT?: string;
  vatAmount?: string;
  amountTTC?: string;
  accountCode?: string;
  status?: ExpenseStatus | '';
}

function isStaffCompensationRecurring(recurring: RecurringExpense): boolean {
  const code = recurring.accountCode || '';
  return code.startsWith('641') || code.startsWith('645');
}

export function ExpensesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  
  // Tri et filtrage
  const [sortField, setSortField] = useState<SortField>('invoiceDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc'); // Tri ascendant: du plus ancien au plus récent
  const [columnFilters, setColumnFilters] = useState<ColumnFilter>({});
  
  // Édition inline
  const [editingCell, setEditingCell] = useState<{ expenseId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingExpense, setSavingExpense] = useState<string | null>(null);
  
  // Sélection multiple
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const [recurringFilterId, setRecurringFilterId] = useState<string | undefined>(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('recurringExpenseId');
    return id || undefined;
  });

  useEffect(() => {
    void loadExpenses();
    void loadRecurringExpenses();
  }, [filters]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await expensesService.getAll(filters);
      // Log pour débogage : vérifier que les champs nécessaires sont présents
      if (data && data.length > 0) {
        const sampleRecurring = data.find(e => e.recurringExpenseId);
        if (sampleRecurring) {
          console.log('[ExpensesPage] Sample recurring expense loaded:', {
            id: sampleRecurring.id,
            isForecast: sampleRecurring.isForecast,
            recurringExpenseId: sampleRecurring.recurringExpenseId,
            status: sampleRecurring.status
          });
        }
      }
      setExpenses(data);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecurringExpenses = async () => {
    try {
      const data = await recurringExpensesService.getAll();
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Erreur chargement dépenses récurrentes:', error);
    }
  };

  const staffRecurringExpenses = useMemo(
    () => recurringExpenses.filter(isStaffCompensationRecurring),
    [recurringExpenses]
  );

  const otherRecurringExpenses = useMemo(
    () => recurringExpenses.filter((r) => !isStaffCompensationRecurring(r)),
    [recurringExpenses]
  );

  const currentMonthStaffExpenseInfo = useMemo(() => {
    if (staffRecurringExpenses.length === 0) {
      return { model: null as RecurringExpense | null, expense: null as Expense | null };
    }
    const model = staffRecurringExpenses.find((m) => m.isActive) || staffRecurringExpenses[0];
    if (!model) return { model: null, expense: null };

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const isSameMonth = (dateString?: string) => {
      if (!dateString) return false;
      const d = new Date(dateString);
      return d.getFullYear() === year && d.getMonth() === month;
    };

    const expense = expenses.find(
      (e) => e.recurringExpenseId === model.id && isSameMonth(e.invoiceDate)
    ) || null;

    return { model, expense };
  }, [expenses, staffRecurringExpenses]);

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense récurrente ? Les dépenses prévisionnelles existantes ne seront pas supprimées.')) {
      return;
    }
    try {
      await recurringExpensesService.delete(id);
      await loadRecurringExpenses();
      await loadExpenses();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleSaveRecurring = async (recurring: RecurringExpense, updates: UpdateRecurringExpenseDto) => {
    try {
      await recurringExpensesService.update(recurring.id, updates);
      setEditingRecurring(null);
      await loadRecurringExpenses();
    } catch (error) {
      console.error('Erreur modification:', error);
      alert('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      return;
    }
    try {
      await expensesService.delete(id);
      await loadExpenses();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleValidateForecast = async (id: string) => {
    try {
      const updatedExpense = await expensesService.validateForecast(id);
      console.log('[ExpensesPage] Dépense validée:', updatedExpense);
      console.log('[ExpensesPage] isForecast:', updatedExpense.isForecast);
      console.log('[ExpensesPage] recurringExpenseId:', updatedExpense.recurringExpenseId);
      
      // Mise à jour locale immédiate pour feedback visuel
      setExpenses(prevExpenses => 
        prevExpenses.map(e => 
          e.id === id ? { ...e, ...updatedExpense } : e
        )
      );
      
      // Recharger pour synchroniser avec le serveur
      await loadExpenses();
    } catch (error) {
      console.error('Erreur validation:', error);
      alert('Erreur lors de la validation');
    }
  };

  // Sauvegarder une modification inline (mise à jour locale sans recharger toute la page)
  const handleSaveCell = async (expenseId: string, field: string, value: string, label?: string) => {
    setSavingExpense(expenseId);
    try {
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) return;

      const updateData: UpdateExpenseDto = {};
      
      switch (field) {
        case 'invoiceDate':
          updateData.invoiceDate = value || undefined;
          break;
        case 'supplierName':
          updateData.supplierName = value || undefined;
          break;
        case 'invoiceNumber':
          updateData.invoiceNumber = value || undefined;
          break;
        case 'amountHT':
          updateData.amountHT = value ? parseFloat(value) : undefined;
          break;
        case 'vatAmount':
          updateData.vatAmount = value ? parseFloat(value) : undefined;
          break;
        case 'amountTTC':
          updateData.amountTTC = value ? parseFloat(value) : undefined;
          break;
        case 'accountCode':
          updateData.accountCode = value || undefined;
          updateData.accountLabel = label || undefined;
          break;
        case 'status':
          updateData.status = value as ExpenseStatus;
          break;
      }

      // Sauvegarder sur le serveur
      const updatedExpense = await expensesService.update(expenseId, updateData);
      
      // Mettre à jour localement sans recharger toute la page
      setExpenses(prevExpenses => 
        prevExpenses.map(e => e.id === expenseId ? { ...e, ...updatedExpense } : e)
      );
      
      setEditingCell(null);
    } catch (error) {
      console.error('Erreur sauvegarde cellule:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSavingExpense(null);
    }
  };

  // Gérer le tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtrer et trier les dépenses
  const filteredAndSortedExpenses = useMemo(() => {
    let filtered = [...expenses];

    // Appliquer les filtres de colonnes
    if (columnFilters.supplierName) {
      const filter = columnFilters.supplierName.toLowerCase();
      filtered = filtered.filter(e => 
        (e.supplierName || '').toLowerCase().includes(filter) ||
        (e.company?.name || '').toLowerCase().includes(filter)
      );
    }
    if (columnFilters.invoiceNumber) {
      const filter = columnFilters.invoiceNumber.toLowerCase();
      filtered = filtered.filter(e => 
        (e.invoiceNumber || '').toLowerCase().includes(filter)
      );
    }
    if (columnFilters.accountCode) {
      const filter = columnFilters.accountCode.toLowerCase();
      filtered = filtered.filter(e => 
        (e.accountCode || '').toLowerCase().includes(filter)
      );
    }
    if (columnFilters.status) {
      filtered = filtered.filter(e => e.status === columnFilters.status);
    }

    if (recurringFilterId) {
      filtered = filtered.filter((e) => e.recurringExpenseId === recurringFilterId);
    }

    // Appliquer le tri (toujours appliqué, y compris au chargement initial)
    // Tri par date du plus récent au plus ancien (ordre chronologique inverse)
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'invoiceDate':
          // Pour tri descendant (du plus récent au plus ancien), placer les dates nulles à la fin
          if (!a.invoiceDate) {
            aValue = sortDirection === 'desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
          } else {
            const dateA = new Date(a.invoiceDate);
            aValue = isNaN(dateA.getTime()) ? (sortDirection === 'desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY) : dateA.getTime();
          }
          if (!b.invoiceDate) {
            bValue = sortDirection === 'desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
          } else {
            const dateB = new Date(b.invoiceDate);
            bValue = isNaN(dateB.getTime()) ? (sortDirection === 'desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY) : dateB.getTime();
          }
          // Les valeurs sont maintenant en millisecondes (timestamp), plus grand = plus récent
          // Pour tri descendant: plus récent (plus grand timestamp) en premier
          if (sortDirection === 'desc') {
            return bValue - aValue; // bValue - aValue pour mettre les plus grandes valeurs (plus récentes) en premier
          } else {
            return aValue - bValue; // aValue - bValue pour mettre les plus petites valeurs (plus anciennes) en premier
          }
        case 'supplierName':
          aValue = (a.supplierName || a.company?.name || '').toLowerCase();
          bValue = (b.supplierName || b.company?.name || '').toLowerCase();
          break;
        case 'invoiceNumber':
          aValue = (a.invoiceNumber || '').toLowerCase();
          bValue = (b.invoiceNumber || '').toLowerCase();
          break;
        case 'amountHT':
          aValue = a.amountHT ? parseFloat(a.amountHT.toString()) : 0;
          bValue = b.amountHT ? parseFloat(b.amountHT.toString()) : 0;
          break;
        case 'vatAmount':
          aValue = a.vatAmount ? parseFloat(a.vatAmount.toString()) : 0;
          bValue = b.vatAmount ? parseFloat(b.vatAmount.toString()) : 0;
          break;
        case 'amountTTC':
          aValue = a.amountTTC ? parseFloat(a.amountTTC.toString()) : 0;
          bValue = b.amountTTC ? parseFloat(b.amountTTC.toString()) : 0;
          break;
        case 'accountCode':
          aValue = (a.accountCode || '').toLowerCase();
          bValue = (b.accountCode || '').toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      // Tri: pour 'desc' (descendant), les plus grandes valeurs (dates plus récentes) doivent être en premier
      // Si aValue > bValue (a plus récent que b) et desc: a doit être avant b -> retourner -1
      // Si aValue < bValue (a plus ancien que b) et desc: a doit être après b -> retourner 1
      if (sortDirection === 'desc') {
        // Tri descendant: plus récent en premier
        if (aValue > bValue) return -1; // a plus récent, a avant b
        if (aValue < bValue) return 1;  // a plus ancien, a après b
      } else {
        // Tri ascendant: plus ancien en premier
        if (aValue < bValue) return -1; // a plus ancien, a avant b
        if (aValue > bValue) return 1;  // a plus récent, a après b
      }
      return 0;
    });

    return filtered;
  }, [expenses, columnFilters, sortField, sortDirection, recurringFilterId]);

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

  const formatDateInput = (date?: string) => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="w-4 h-4 inline-block ml-1" />
    ) : (
      <ChevronDownIcon className="w-4 h-4 inline-block ml-1" />
    );
  };

  const startEditing = (expenseId: string, field: string, currentValue: any) => {
    setEditingCell({ expenseId, field });
    if (field === 'invoiceDate') {
      setEditValue(formatDateInput(currentValue));
    } else if (field === 'amountHT' || field === 'vatAmount' || field === 'amountTTC') {
      setEditValue(currentValue ? currentValue.toString() : '');
    } else {
      setEditValue(currentValue || '');
    }
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEditing = async () => {
    if (editingCell) {
      await handleSaveCell(editingCell.expenseId, editingCell.field, editValue);
    }
  };

  // Gestion de la sélection multiple (clic direct sur la ligne)
  const handleRowClick = (expenseId: string, e: React.MouseEvent) => {
    // Ne pas sélectionner si on clique sur un champ éditable ou un bouton
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }
    
    setSelectedExpenseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId);
      } else {
        newSet.add(expenseId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedExpenseIds.size === filteredAndSortedExpenses.length) {
      setSelectedExpenseIds(new Set());
    } else {
      setSelectedExpenseIds(new Set(filteredAndSortedExpenses.map(e => e.id)));
    }
  };

  const handleFilterByRecurring = (recurringId: string) => {
    setRecurringFilterId(recurringId);
    const params = new URLSearchParams(location.search);
    params.set('recurringExpenseId', recurringId);
    navigate({
      pathname: '/depenses',
      search: params.toString()
    });
  };

  const handleClearRecurringFilter = () => {
    setRecurringFilterId(undefined);
    const params = new URLSearchParams(location.search);
    params.delete('recurringExpenseId');
    navigate({
      pathname: '/depenses',
      search: params.toString()
    });
  };

  const handleCreateCurrentMonthStaffExpense = async () => {
    const { model } = currentMonthStaffExpenseInfo;
    if (!model) return;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    try {
      const generated = await recurringExpensesService.generateForecast(
        model.id,
        start.toISOString(),
        end.toISOString()
      );

      await loadExpenses();

      const created: Expense | undefined =
        (generated as any[] | undefined)?.find?.((e: any) => e.recurringExpenseId === model.id) ||
        expenses.find(
          (e) =>
            e.recurringExpenseId === model.id &&
            e.invoiceDate &&
            new Date(e.invoiceDate).getMonth() === now.getMonth() &&
            new Date(e.invoiceDate).getFullYear() === now.getFullYear()
        );

      if (created) {
        navigate(`/depenses/${created.id}`);
      }
    } catch (error) {
      console.error('Erreur génération dépense de rémunération du mois:', error);
      alert('Erreur lors de la génération de la dépense de rémunération du mois');
    }
  };

  // Édition en masse
  const handleBulkUpdateStatus = async (status: ExpenseStatus) => {
    if (selectedExpenseIds.size === 0) return;
    
    if (!confirm(`Voulez-vous changer le statut de ${selectedExpenseIds.size} dépense(s) en "${STATUS_LABELS[status]}" ?`)) {
      return;
    }

    try {
      const updatePromises = Array.from(selectedExpenseIds).map(id =>
        expensesService.update(id, { status })
      );
      
      const updatedExpenses = await Promise.all(updatePromises);
      
      // Mettre à jour localement
      setExpenses(prevExpenses => 
        prevExpenses.map(e => {
          if (selectedExpenseIds.has(e.id)) {
            const updated = updatedExpenses.find(ue => ue.id === e.id);
            return updated ? { ...e, ...updated } : e;
          }
          return e;
        })
      );
      
      setSelectedExpenseIds(new Set());
      await loadExpenses(); // Recharger pour synchroniser
    } catch (error) {
      console.error('Erreur édition en masse:', error);
      alert('Erreur lors de l\'édition en masse');
    }
  };

  const handleBulkUpdateForecast = async (isForecast: boolean) => {
    if (selectedExpenseIds.size === 0) return;
    
    if (!confirm(`Voulez-vous ${isForecast ? 'marquer' : 'démarquer'} ${selectedExpenseIds.size} dépense(s) comme prévisionnelle(s) ?`)) {
      return;
    }

    try {
      const updatePromises = Array.from(selectedExpenseIds).map(id =>
        expensesService.update(id, { isForecast })
      );
      
      const updatedExpenses = await Promise.all(updatePromises);
      
      // Mettre à jour localement
      setExpenses(prevExpenses => 
        prevExpenses.map(e => {
          if (selectedExpenseIds.has(e.id)) {
            const updated = updatedExpenses.find(ue => ue.id === e.id);
            return updated ? { ...e, ...updated } : e;
          }
          return e;
        })
      );
      
      setSelectedExpenseIds(new Set());
      await loadExpenses(); // Recharger pour synchroniser
    } catch (error) {
      console.error('Erreur édition en masse prévisionnel:', error);
      alert('Erreur lors de l\'édition en masse');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedExpenseIds.size === 0) return;
    
    if (!confirm(`Voulez-vous supprimer ${selectedExpenseIds.size} dépense(s) ?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedExpenseIds).map(id =>
        expensesService.delete(id)
      );
      
      await Promise.all(deletePromises);
      
      // Mettre à jour localement
      setExpenses(prevExpenses => 
        prevExpenses.filter(e => !selectedExpenseIds.has(e.id))
      );
      
      setSelectedExpenseIds(new Set());
      await loadExpenses(); // Recharger pour synchroniser
    } catch (error) {
      console.error('Erreur suppression en masse:', error);
      alert('Erreur lors de la suppression en masse');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Dépenses</h1>
          <p className="text-sm text-slate-500">Gérez vos factures et tickets de dépense.</p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          variant="primary"
          icon={<PlusIcon className="w-5 h-5" />}
        >
          Nouvelle dépense
        </Button>
      </div>

      {/* Filtres principaux */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as ExpenseStatus || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">Tous</option>
              {DISPLAY_STATUSES.map((value) => (
                <option key={value} value={value}>{STATUS_LABELS[value]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date début
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date fin
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Bloc Rémunération du mois */}
      {currentMonthStaffExpenseInfo.model && (
        <div className="bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-indigo-700 mb-1">
              Rémunération du personnel
            </p>
            <p className="text-sm text-slate-700">
              Mois en cours :{' '}
              <span className="font-semibold">
                {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            </p>
            {currentMonthStaffExpenseInfo.expense ? (
              <p className="text-sm text-slate-600 mt-1">
                Montant :{' '}
                <span className="font-semibold">
                  {formatCurrency(currentMonthStaffExpenseInfo.expense.amountTTC)}
                </span>{' '}
                – Statut :{' '}
                <span className="font-semibold">
                  {STATUS_LABELS[currentMonthStaffExpenseInfo.expense.status]}
                  {currentMonthStaffExpenseInfo.expense.isForecast ? ' (prévisionnel)' : ''}
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-600 mt-1">
                Aucune dépense de rémunération créée pour ce mois.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentMonthStaffExpenseInfo.expense ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/depenses/${currentMonthStaffExpenseInfo.expense!.id}`)}
              >
                Ouvrir la dépense
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleCreateCurrentMonthStaffExpense}>
                Créer la dépense de ce mois
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Section Dépenses récurrentes */}
      {recurringExpenses.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Dépenses récurrentes</h2>
          <div className="space-y-4">
            {staffRecurringExpenses.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Rémunération du personnel
                </h3>
                <div className="space-y-2">
                  {staffRecurringExpenses.map((recurring) => (
                    <div
                      key={recurring.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-900">
                            {recurring.supplierName || 'Sans nom'}
                          </div>
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Rémunération personnel
                          </span>
                        </div>
                        <div className="text-sm text-slate-500">
                          {recurring.amountTTC
                            ? new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(recurring.amountTTC)
                            : '-'}
                          {' • '}
                          {recurring.recurrenceType === 'MONTHLY'
                            ? 'Mensuel'
                            : recurring.recurrenceType === 'WEEKLY'
                            ? 'Hebdomadaire'
                            : recurring.recurrenceType === 'QUARTERLY'
                            ? 'Trimestriel'
                            : 'Annuel'}
                          {' • Jour '}
                          {recurring.paymentDay}
                          {recurring.isActive ? '' : ' • Inactif'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleFilterByRecurring(recurring.id)}
                          variant="secondary"
                          size="sm"
                        >
                          Voir les échéances
                        </Button>
                        <Button
                          onClick={() => setEditingRecurring(recurring)}
                          variant="secondary"
                          size="sm"
                          icon={<PencilIcon className="w-4 h-4" />}
                          title="Modifier cette dépense récurrente"
                        >
                          Modifier
                        </Button>
                        <Button
                          onClick={() => handleDeleteRecurring(recurring.id)}
                          variant="danger"
                          size="sm"
                          icon={<TrashIcon className="w-4 h-4" />}
                          title="Supprimer cette dépense récurrente"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {otherRecurringExpenses.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  Autres dépenses récurrentes
                </h3>
                <div className="space-y-2">
                  {otherRecurringExpenses.map((recurring) => (
                    <div
                      key={recurring.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">
                          {recurring.supplierName || 'Sans nom'}
                        </div>
                        <div className="text-sm text-slate-500">
                          {recurring.amountTTC
                            ? new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(recurring.amountTTC)
                            : '-'}
                          {' • '}
                          {recurring.recurrenceType === 'MONTHLY'
                            ? 'Mensuel'
                            : recurring.recurrenceType === 'WEEKLY'
                            ? 'Hebdomadaire'
                            : recurring.recurrenceType === 'QUARTERLY'
                            ? 'Trimestriel'
                            : 'Annuel'}
                          {' • Jour '}
                          {recurring.paymentDay}
                          {recurring.isActive ? '' : ' • Inactif'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleFilterByRecurring(recurring.id)}
                          variant="secondary"
                          size="sm"
                        >
                          Voir les échéances
                        </Button>
                        <Button
                          onClick={() => setEditingRecurring(recurring)}
                          variant="secondary"
                          size="sm"
                          icon={<PencilIcon className="w-4 h-4" />}
                          title="Modifier cette dépense récurrente"
                        >
                          Modifier
                        </Button>
                        <Button
                          onClick={() => handleDeleteRecurring(recurring.id)}
                          variant="danger"
                          size="sm"
                          icon={<TrashIcon className="w-4 h-4" />}
                          title="Supprimer cette dépense récurrente"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barre d'actions en masse */}
      {selectedExpenseIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="text-sm font-medium text-indigo-900">
                {selectedExpenseIds.size} dépense(s) sélectionnée(s)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-indigo-700 font-medium">Statut:</span>
                {DISPLAY_STATUSES.map((value) => (
                  <Button
                    key={value}
                    onClick={() => handleBulkUpdateStatus(value)}
                    variant="secondary"
                    size="sm"
                  >
                    {STATUS_LABELS[value]}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-indigo-700 font-medium">Prévisionnel:</span>
                <Button
                  onClick={() => handleBulkUpdateForecast(true)}
                  variant="secondary"
                  size="sm"
                >
                  Oui
                </Button>
                <Button
                  onClick={() => handleBulkUpdateForecast(false)}
                  variant="secondary"
                  size="sm"
                >
                  Non
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBulkDelete}
                variant="danger"
                size="sm"
              >
                Supprimer
              </Button>
              <Button
                onClick={() => setSelectedExpenseIds(new Set())}
                variant="secondary"
                size="sm"
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tableau éditable */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {recurringFilterId && (
          <div className="px-4 pt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs text-indigo-800">
              <span>
                Filtré sur le modèle récurrent{' '}
                <span className="font-semibold">{recurringFilterId}</span>
              </span>
              <button
                type="button"
                onClick={handleClearRecurringFilter}
                className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold hover:bg-indigo-200"
              >
                Effacer
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement...</div>
        ) : filteredAndSortedExpenses.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Aucune dépense trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    className="px-4 py-2 text-left w-12"
                  >
                    <div 
                      className="text-xs font-medium text-slate-600 uppercase cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 -my-0.5 inline-block"
                      onClick={toggleSelectAll}
                      title={selectedExpenseIds.size === filteredAndSortedExpenses.length && filteredAndSortedExpenses.length > 0 ? "Tout désélectionner" : "Tout sélectionner"}
                    >
                      {selectedExpenseIds.size === filteredAndSortedExpenses.length && filteredAndSortedExpenses.length > 0 ? '✓' : ''}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <div 
                      className="text-xs font-medium text-slate-600 uppercase cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 inline-flex items-center w-fit"
                      onClick={() => handleSort('invoiceDate')}
                    >
                      Date {getSortIcon('invoiceDate')}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <div className="flex flex-col gap-1">
                      <div 
                        className="text-xs font-medium text-slate-600 uppercase cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 inline-flex items-center w-fit"
                        onClick={() => handleSort('supplierName')}
                      >
                        Fournisseur {getSortIcon('supplierName')}
                      </div>
                      <input
                        type="text"
                        value={columnFilters.supplierName || ''}
                        onChange={(e) => setColumnFilters({ ...columnFilters, supplierName: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Filtrer..."
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left hidden">
                    <div className="flex flex-col gap-1">
                      <div 
                        className="text-xs font-medium text-slate-600 uppercase cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 inline-flex items-center w-fit"
                        onClick={() => handleSort('invoiceNumber')}
                      >
                        N° Facture {getSortIcon('invoiceNumber')}
                      </div>
                    </div>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <div className="flex flex-col gap-1 items-end">
                      <div 
                        className="text-xs font-medium text-slate-600 uppercase cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 inline-flex items-center w-fit"
                        onClick={() => handleSort('amountTTC')}
                      >
                        Montant {getSortIcon('amountTTC')}
                      </div>
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <div className="flex flex-col gap-1">
                      <div 
                        className="text-xs font-medium text-slate-600 uppercase cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 inline-flex items-center w-fit"
                        onClick={() => handleSort('accountCode')}
                      >
                        Compte {getSortIcon('accountCode')}
                      </div>
                      <input
                        type="text"
                        value={columnFilters.accountCode || ''}
                        onChange={(e) => setColumnFilters({ ...columnFilters, accountCode: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Filtrer..."
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <div className="text-xs font-medium text-slate-600 uppercase">
                      Opportunité + Client
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <div className="flex flex-col gap-1">
                      <div 
                        className="text-xs font-medium text-slate-600 uppercase cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 -mx-1 inline-flex items-center w-fit"
                        onClick={() => handleSort('status')}
                      >
                        Statut {getSortIcon('status')}
                      </div>
                      <select
                        value={columnFilters.status || ''}
                        onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value as ExpenseStatus || '' })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Tous</option>
                        {DISPLAY_STATUSES.map((value) => (
                          <option key={value} value={value}>{STATUS_LABELS[value]}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <div className="text-xs font-medium text-slate-600 uppercase">
                      Actions
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAndSortedExpenses.map((expense) => (
                  <tr 
                    key={expense.id} 
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      selectedExpenseIds.has(expense.id) 
                        ? 'bg-indigo-50 border-l-4 border-indigo-500' 
                        : 'border-l-4 border-transparent'
                    }`}
                    onClick={(e) => handleRowClick(expense.id, e)}
                  >
                    {/* Indicateur de sélection */}
                    <td className="px-4 py-3">
                      {selectedExpenseIds.has(expense.id) && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      )}
                    </td>
                    {/* Date */}
                    <td 
                      className="px-4 py-3 text-sm text-slate-900 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editingCell) startEditing(expense.id, 'invoiceDate', expense.invoiceDate);
                      }}
                    >
                      {editingCell?.expenseId === expense.id && editingCell.field === 'invoiceDate' ? (
                        <input
                          type="date"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-sm border border-indigo-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        formatDate(expense.invoiceDate)
                      )}
                    </td>
                    {/* Fournisseur */}
                    <td 
                      className="px-4 py-3 text-sm text-slate-900 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editingCell) startEditing(expense.id, 'supplierName', expense.supplierName || expense.company?.name);
                      }}
                    >
                      {editingCell?.expenseId === expense.id && editingCell.field === 'supplierName' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-sm border border-indigo-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        expense.supplierName || expense.company?.name || '-'
                      )}
                    </td>
                    {/* N° Facture - Masquée */}
                    <td 
                      className="px-4 py-3 text-sm text-slate-600 cursor-pointer hidden"
                      onClick={() => !editingCell && startEditing(expense.id, 'invoiceNumber', expense.invoiceNumber)}
                    >
                      {editingCell?.expenseId === expense.id && editingCell.field === 'invoiceNumber' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-sm border border-indigo-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        expense.invoiceNumber || '-'
                      )}
                    </td>
                    {/* Montant (TTC + HT) */}
                    <td 
                      className="px-4 py-3 text-sm text-right"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editingCell) {
                          startEditing(expense.id, 'amountTTC', expense.amountTTC);
                        }
                      }}
                    >
                      {editingCell?.expenseId === expense.id && editingCell.field === 'amountTTC' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                        />
                      ) : (
                        <div className="cursor-pointer">
                          <div className="font-medium text-slate-900">
                            {formatCurrency(expense.amountTTC)}
                          </div>
                          {expense.amountHT && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              HT: {formatCurrency(expense.amountHT)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Compte */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {editingCell?.expenseId === expense.id && editingCell.field === 'accountCode' ? (
                        <div className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                          <AccountCodeSelector
                            value={editValue}
                            onChange={async (code, label) => {
                              setEditValue(code);
                              await handleSaveCell(expense.id, 'accountCode', code, label);
                            }}
                            className="w-full"
                          />
                        </div>
                      ) : (
                        <span 
                          className="cursor-pointer hover:text-indigo-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingCell) startEditing(expense.id, 'accountCode', expense.accountCode);
                          }}
                        >
                          {expense.accountCode ? (
                            <>
                              {expense.accountCode}
                              {expense.accountLabel ? (
                                <span className="text-slate-500 ml-1">- {expense.accountLabel}</span>
                              ) : (
                                <span className="text-slate-400 italic ml-1">(sans intitulé)</span>
                              )}
                            </>
                          ) : '-'}
                        </span>
                      )}
                    </td>
                    {/* Opportunité + Client */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="space-y-1">
                        {expense.opportunity && (
                          <div className="font-medium text-slate-900">
                            {expense.opportunity.title}
                          </div>
                        )}
                        {/* Afficher le client via l'opportunité en priorité, sinon le company direct */}
                        {(expense.opportunity?.company?.name || expense.company?.name) ? (
                          <div className="text-slate-500 text-xs">
                            {expense.opportunity?.company?.name || expense.company?.name}
                          </div>
                        ) : null}
                        {!expense.opportunity && !expense.company && (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    {/* Statut */}
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.expenseId === expense.id && editingCell.field === 'status' ? (
                        <select
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            handleSaveCell(expense.id, 'status', e.target.value);
                          }}
                          onBlur={saveEditing}
                          autoFocus
                          className="px-2 py-1 text-xs border border-indigo-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <div 
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingCell) startEditing(expense.id, 'status', expense.status);
                          }}
                        >
                          <Badge variant={STATUS_TO_BADGE_VARIANT[expense.status]}>
                            {STATUS_LABELS[expense.status]}
                          </Badge>
                          {expense.isForecast && (
                            <Badge variant="forecast">Prévisionnel</Badge>
                          )}
                          {savingExpense === expense.id && (
                            <span className="text-xs text-slate-400">Sauvegarde...</span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex justify-end gap-2">
                        {expense.isForecast && (
                          <Button
                            onClick={() => handleValidateForecast(expense.id)}
                            variant="success"
                            size="sm"
                            icon={<CheckIcon className="w-4 h-4" />}
                            title="Vérifier cette dépense prévisionnelle"
                          >
                            Vérifié
                          </Button>
                        )}
                        {expense.status === 'VERIFIED' && !expense.isForecast && (
                          <Button
                            onClick={async () => {
                              try {
                                await expensesService.update(expense.id, { status: 'PAID' });
                                await loadExpenses();
                              } catch (error) {
                                console.error('Erreur lors du marquage comme réglé:', error);
                                alert('Erreur lors du marquage comme réglé');
                              }
                            }}
                            variant="primary"
                            size="sm"
                            icon={<CheckIcon className="w-4 h-4" />}
                            title="Marquer comme réglé"
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            Réglé
                          </Button>
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/depenses/${expense.id}`);
                          }}
                          variant="secondary"
                          size="sm"
                          icon={<EyeIcon className="w-4 h-4" />}
                        >
                          Voir
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(expense.id);
                          }}
                          variant="danger"
                          size="sm"
                          icon={<TrashIcon className="w-4 h-4" />}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseUploadModal
          onClose={() => {
            setShowModal(false);
            void loadExpenses();
          }}
        />
      )}

      {/* Modal de modification de dépense récurrente */}
      {editingRecurring && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Modifier la dépense récurrente</h2>
                <button
                  onClick={() => setEditingRecurring(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <RecurringExpenseEditForm
                recurring={editingRecurring}
                onSave={(updates) => handleSaveRecurring(editingRecurring, updates)}
                onCancel={() => setEditingRecurring(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
