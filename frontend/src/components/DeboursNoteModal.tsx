import { useState, FormEvent, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { deboursNoteService, CreateDeboursNoteDto, DeboursNote } from '../services/deboursNoteService';
import { expensesService, Expense, CreateExpenseDto } from '../services/expensesService';
import { SupplierSearchSelect } from './SupplierSearchSelect';
import { AccountCodeSelector } from './AccountCodeSelector';
import { supplierPreferencesService } from '../services/supplierPreferences';
import api from '../services/apiClient';

interface DeboursNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  onSuccess: () => void;
  deboursNote?: DeboursNote; // Pour l'édition
}

export function DeboursNoteModal({
  isOpen,
  onClose,
  opportunityId,
  opportunityTitle,
  onSuccess,
  deboursNote
}: DeboursNoteModalProps) {
  const isEditMode = !!deboursNote;
  const [title, setTitle] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedPaymentDate, setExpectedPaymentDate] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableExpenses, setAvailableExpenses] = useState<Expense[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [showCreateExpense, setShowCreateExpense] = useState(false);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [newExpense, setNewExpense] = useState({
    supplierName: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    amountTTC: '',
    amountHT: '',
    vatRate: '20',
    accountCode: '',
    accountLabel: ''
  });

  useEffect(() => {
    if (isOpen) {
      try {
        if (deboursNote) {
          // Mode édition - charger les données complètes si nécessaire
          console.log('Mode édition - deboursNote:', deboursNote);
          setTitle(deboursNote.title || '');
          setIssueDate(deboursNote.issueDate ? new Date(deboursNote.issueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          setExpectedPaymentDate(deboursNote.expectedPaymentDate ? new Date(deboursNote.expectedPaymentDate).toISOString().split('T')[0] : '');
          setTotalAmount(deboursNote.totalAmount?.toString() || '');
          setInvoiceNumber(deboursNote.invoiceNumber || '');
          setNotes(deboursNote.notes || '');
          setSelectedTemplateId(deboursNote.templateId || '');
          // S'assurer que expenses est un tableau avant de mapper
          const expenseIds = Array.isArray(deboursNote.expenses) 
            ? deboursNote.expenses.map((e: any) => e?.id).filter(Boolean)
            : [];
          console.log('Expense IDs chargés:', expenseIds);
          setSelectedExpenseIds(expenseIds);
        } else {
          // Mode création
          setTitle(`Note de débours - ${opportunityTitle}`);
          setIssueDate(new Date().toISOString().split('T')[0]);
          setExpectedPaymentDate('');
          setTotalAmount('');
          setInvoiceNumber('');
          setNotes('');
          setSelectedTemplateId('');
          setSelectedExpenseIds([]);
        }
        setError(null);
        setShowCreateExpense(false);
        setSelectedSupplierId('');
        setNewExpense({
          supplierName: '',
          invoiceNumber: '',
          invoiceDate: new Date().toISOString().split('T')[0],
          amountTTC: '',
          amountHT: '',
          vatRate: '20',
          accountCode: '',
          accountLabel: ''
        });
        void loadAvailableExpenses();
      } catch (error) {
        console.error('Erreur lors de l\'initialisation du modal:', error);
        setError('Erreur lors du chargement de la note de débours');
      }
    }
  }, [isOpen, opportunityId, opportunityTitle, deboursNote]);

  const loadAvailableExpenses = async () => {
    try {
      const expenses = await expensesService.getAll({ opportunityId });
      setAvailableExpenses(expenses);
    } catch (error) {
      console.error('Erreur chargement dépenses:', error);
    }
  };


  // Calculer le montant total depuis les dépenses sélectionnées
  useEffect(() => {
    if (selectedExpenseIds.length > 0) {
      const total = availableExpenses
        .filter(exp => selectedExpenseIds.includes(exp.id))
        .reduce((sum, exp) => sum + (parseFloat(exp.amountTTC?.toString() || exp.amountHT?.toString() || '0') || 0), 0);
      setTotalAmount(total.toFixed(2));
    } else {
      setTotalAmount('');
    }
  }, [selectedExpenseIds, availableExpenses]);

  if (!isOpen) return null;

  // Protection contre les erreurs de rendu
  if (isEditMode && !deboursNote) {
    console.error('Mode édition activé mais deboursNote est undefined');
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
          <div className="text-red-600">
            <p>Erreur : Impossible de charger la note de débours pour l'édition.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && deboursNote) {
        // Mode édition
        const updateDto: any = {
          title,
          issueDate: issueDate ? new Date(issueDate + 'T00:00:00').toISOString() : undefined,
          expectedPaymentDate: expectedPaymentDate ? new Date(expectedPaymentDate + 'T00:00:00').toISOString() : undefined,
          totalAmount: parseFloat(totalAmount),
          expenseIds: selectedExpenseIds.length > 0 ? selectedExpenseIds : undefined,
          notes: notes || undefined,
          templateId: selectedTemplateId || undefined,
        };
        
        // Toujours envoyer invoiceNumber (même si vide, pour permettre de vider le champ)
        // invoiceNumber est toujours défini (string initialisé à '')
        const trimmedInvoiceNumber = invoiceNumber.trim();
        updateDto.invoiceNumber = trimmedInvoiceNumber !== '' ? trimmedInvoiceNumber : null;
        
        console.log('Envoi updateDto avec invoiceNumber:', updateDto.invoiceNumber, '(valeur originale:', invoiceNumber, ')');
        await deboursNoteService.update(deboursNote.id, updateDto);
        // Le Google Docs sera mis à jour automatiquement par l'API si googleDocId existe
      } else {
        // Mode création
        const dto: CreateDeboursNoteDto = {
          title,
          issueDate: issueDate ? new Date(issueDate + 'T00:00:00').toISOString() : undefined,
          expectedPaymentDate: expectedPaymentDate ? new Date(expectedPaymentDate + 'T00:00:00').toISOString() : undefined,
          totalAmount: parseFloat(totalAmount),
          opportunityId,
          expenseIds: selectedExpenseIds.length > 0 ? selectedExpenseIds : undefined,
          invoiceNumber: invoiceNumber ? invoiceNumber : undefined,
          notes: notes || undefined,
          templateId: selectedTemplateId || undefined,
          status: 'DRAFT'
        };

        const created = await deboursNoteService.create(dto);
        
        // Générer automatiquement le document Google Docs
        setGeneratingDoc(true);
        try {
          await deboursNoteService.generateDoc(created.id, selectedTemplateId || undefined);
        } catch (docError: any) {
          console.error('Erreur génération document:', docError);
          // Ne pas bloquer si la génération échoue
          setError('Note créée mais erreur lors de la génération du document Google Docs. Vous pourrez le générer manuellement.');
        }
        setGeneratingDoc(false);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || `Erreur lors de la ${isEditMode ? 'modification' : 'création'} de la note de débours`);
      setGeneratingDoc(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpense = (expenseId: string) => {
    setSelectedExpenseIds(prev =>
      prev.includes(expenseId)
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  // Charger les préférences du fournisseur sélectionné
  useEffect(() => {
    if (selectedSupplierId && showCreateExpense) {
      const prefs = supplierPreferencesService.get(selectedSupplierId);
      if (prefs) {
        if (prefs.vatRate !== undefined) {
          setNewExpense(prev => ({ ...prev, vatRate: (prefs.vatRate! * 100).toFixed(2) }));
        }
        if (prefs.accountCode) {
          setNewExpense(prev => ({ ...prev, accountCode: prefs.accountCode!, accountLabel: prefs.accountLabel || '' }));
        }
      }
    } else if (newExpense.supplierName && !selectedSupplierId && showCreateExpense) {
      // Si pas d'ID mais un nom, essayer de charger par nom
      const prefs = supplierPreferencesService.getByName(newExpense.supplierName);
      if (prefs) {
        if (prefs.vatRate !== undefined) {
          setNewExpense(prev => ({ ...prev, vatRate: (prefs.vatRate! * 100).toFixed(2) }));
        }
        if (prefs.accountCode) {
          setNewExpense(prev => ({ ...prev, accountCode: prefs.accountCode!, accountLabel: prefs.accountLabel || '' }));
        }
      }
    }
  }, [selectedSupplierId, newExpense.supplierName, showCreateExpense]);

  const handleCreateExpense = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Empêcher la propagation au formulaire parent
    setCreatingExpense(true);
    setError(null);

    try {
      const expenseDto: CreateExpenseDto = {
        supplierName: newExpense.supplierName || undefined,
        invoiceNumber: newExpense.invoiceNumber || undefined,
        invoiceDate: newExpense.invoiceDate || undefined,
        amountTTC: newExpense.amountTTC ? parseFloat(newExpense.amountTTC) : undefined,
        amountHT: newExpense.amountHT ? parseFloat(newExpense.amountHT) : undefined,
        vatRate: newExpense.vatRate ? parseFloat(newExpense.vatRate) / 100 : undefined,
        accountCode: newExpense.accountCode || undefined,
        accountLabel: newExpense.accountLabel || undefined,
        opportunityId,
        status: 'VERIFIED'
      };

      const createdExpense = await expensesService.create(expenseDto);
      
      // Sauvegarder les préférences du fournisseur
      if (selectedSupplierId && (newExpense.vatRate || newExpense.accountCode)) {
        supplierPreferencesService.save(selectedSupplierId, {
          vatRate: newExpense.vatRate ? parseFloat(newExpense.vatRate) / 100 : undefined,
          accountCode: newExpense.accountCode || undefined,
          accountLabel: newExpense.accountLabel || undefined
        });
      } else if (newExpense.supplierName && (newExpense.vatRate || newExpense.accountCode)) {
        supplierPreferencesService.saveByName(newExpense.supplierName, {
          vatRate: newExpense.vatRate ? parseFloat(newExpense.vatRate) / 100 : undefined,
          accountCode: newExpense.accountCode || undefined,
          accountLabel: newExpense.accountLabel || undefined
        });
      }
      
      // Rafraîchir la liste des dépenses
      await loadAvailableExpenses();
      
      // Sélectionner automatiquement la nouvelle dépense
      setSelectedExpenseIds([...selectedExpenseIds, createdExpense.id]);
      
      // Réinitialiser le formulaire et masquer
      setSelectedSupplierId('');
      setNewExpense({
        supplierName: '',
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        amountTTC: '',
        amountHT: '',
        vatRate: '20',
        accountCode: '',
        accountLabel: ''
      });
      setShowCreateExpense(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erreur lors de la création de la dépense');
    } finally {
      setCreatingExpense(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {isEditMode ? 'Modifier la note de débours' : 'Créer une note de débours'}
          </h2>
          <div className="flex items-center gap-2">
            {isEditMode && deboursNote && (
              <button
                onClick={async () => {
                  if (window.confirm('Êtes-vous sûr de vouloir supprimer cette note de débours ?\n\nLa note et le document Google Docs associé seront définitivement supprimés.')) {
                    try {
                      setLoading(true);
                      await deboursNoteService.delete(deboursNote.id);
                      onSuccess();
                      onClose();
                    } catch (err: any) {
                      setError(err.response?.data?.message || 'Erreur lors de la suppression de la note de débours');
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                disabled={loading}
              >
                <TrashIcon className="h-4 w-4" />
                Supprimer
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Opportunité : <span className="font-medium">{opportunityTitle}</span>
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {generatingDoc && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
            Génération du document Google Docs en cours...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Titre
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date d'émission
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date prévisionnelle de paiement
                </label>
                <input
                  type="date"
                  value={expectedPaymentDate}
                  onChange={(e) => setExpectedPaymentDate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                N° de facture
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder='Pour alimenter {{num_facture}} dans le template'
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Ce numéro sera utilisé pour remplacer {'{{num_facture}}'} dans le template Google Docs
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Montant total TTC (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              {selectedExpenseIds.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Montant calculé depuis {selectedExpenseIds.length} dépense(s) sélectionnée(s)
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Dépenses à inclure (optionnel)
                </label>
                {!showCreateExpense && (
                  <button
                    type="button"
                    onClick={() => setShowCreateExpense(true)}
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Créer une dépense
                  </button>
                )}
              </div>
              
              {showCreateExpense && (
                <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-indigo-900">Nouvelle dépense</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateExpense(false);
                        setSelectedSupplierId('');
                        setNewExpense({
                          supplierName: '',
                          invoiceNumber: '',
                          invoiceDate: new Date().toISOString().split('T')[0],
                          amountTTC: '',
                          amountHT: '',
                          vatRate: '20',
                          accountCode: '',
                          accountLabel: ''
                        });
                      }}
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleCreateExpense(e);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="space-y-3" 
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type !== 'textarea') {
                        e.stopPropagation();
                      }
                    }}
                  >
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Fournisseur *
                      </label>
                      <SupplierSearchSelect
                        selectedSupplierId={selectedSupplierId}
                        onSelectSupplier={(supplierId, supplierName) => {
                          setSelectedSupplierId(supplierId || '');
                          setNewExpense({ ...newExpense, supplierName: supplierName || '' });
                        }}
                        onCreateSupplier={async (name: string, companyData?: any) => {
                          try {
                            const dataToSend = companyData || { name, statusSupplier: true };
                            if (!companyData) {
                              dataToSend.statusSupplier = true;
                            }
                            const { data } = await api.post('/api/companies', dataToSend);
                            setSelectedSupplierId(data.id);
                            setNewExpense({ ...newExpense, supplierName: data.name });
                            return data;
                          } catch (error) {
                            console.error('Erreur création fournisseur:', error);
                            throw error;
                          }
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          N° Facture
                        </label>
                        <input
                          type="text"
                          value={newExpense.invoiceNumber}
                          onChange={(e) => setNewExpense({ ...newExpense, invoiceNumber: e.target.value })}
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Date facture *
                        </label>
                        <input
                          type="date"
                          value={newExpense.invoiceDate}
                          onChange={(e) => setNewExpense({ ...newExpense, invoiceDate: e.target.value })}
                          required
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Montant HT (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newExpense.amountHT}
                          onChange={(e) => {
                            const ht = e.target.value;
                            const rate = parseFloat(newExpense.vatRate) / 100;
                            const ttc = ht && !isNaN(parseFloat(ht))
                              ? (parseFloat(ht) * (1 + rate)).toFixed(2)
                              : '';
                            setNewExpense({ ...newExpense, amountHT: ht, amountTTC: ttc });
                          }}
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Taux TVA (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newExpense.vatRate}
                          onChange={(e) => {
                            const vat = e.target.value;
                            const rate = parseFloat(vat) / 100;
                            const ttc = newExpense.amountHT && !isNaN(parseFloat(newExpense.amountHT))
                              ? (parseFloat(newExpense.amountHT) * (1 + rate)).toFixed(2)
                              : newExpense.amountTTC;
                            setNewExpense({ ...newExpense, vatRate: vat, amountTTC: ttc });
                          }}
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                          placeholder="20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Montant TTC (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newExpense.amountTTC}
                        onChange={(e) => {
                          const ttc = e.target.value;
                          const rate = parseFloat(newExpense.vatRate) / 100;
                          const ht = ttc && !isNaN(parseFloat(ttc)) && rate > 0
                            ? (parseFloat(ttc) / (1 + rate)).toFixed(2)
                            : newExpense.amountHT;
                          setNewExpense({ ...newExpense, amountTTC: ttc, amountHT: ht });
                        }}
                        required
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <AccountCodeSelector
                        value={newExpense.accountCode}
                        onChange={(code, label) => {
                          setNewExpense({ ...newExpense, accountCode: code, accountLabel: label });
                        }}
                        label="Code compte"
                        required
                        className="text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateExpense(false);
                          setSelectedSupplierId('');
                          setNewExpense({
                            supplierName: '',
                            invoiceNumber: '',
                            invoiceDate: new Date().toISOString().split('T')[0],
                            amountTTC: '',
                            amountHT: '',
                            vatRate: '20',
                            accountCode: '',
                            accountLabel: ''
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={creatingExpense || !newExpense.amountTTC || !newExpense.supplierName || !newExpense.accountCode}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {creatingExpense ? 'Création...' : 'Créer'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="border border-slate-200 rounded-md max-h-48 overflow-y-auto">
                {availableExpenses.length === 0 && !showCreateExpense ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-slate-500 mb-2">
                      Aucune dépense disponible pour cette opportunité
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCreateExpense(true)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Créer une dépense maintenant
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {availableExpenses.map(expense => (
                      <label
                        key={expense.id}
                        className="flex items-center p-3 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedExpenseIds.includes(expense.id)}
                          onChange={() => toggleExpense(expense.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-slate-900">
                            {expense.supplierName || 'Sans nom'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {expense.invoiceDate ? new Date(expense.invoiceDate).toLocaleDateString('fr-FR') : ''}
                            {expense.amountTTC && ` • ${parseFloat(expense.amountTTC.toString()).toFixed(2)} € TTC`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Modèle de document (optionnel)
              </label>
              <input
                type="text"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                placeholder="ID du modèle Google Docs (ex: 1Zn5P7uqHnIj_-85-Qh6roVHe2WwCt8gBamEdZYMA7CA)"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Laissez vide pour utiliser le modèle par défaut. L'ID se trouve dans l'URL du document Google Docs.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || generatingDoc || !totalAmount || !title}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {generatingDoc ? 'Génération du document...' : loading ? (isEditMode ? 'Modification...' : 'Création...') : (isEditMode ? 'Enregistrer les modifications' : 'Créer et générer le document')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

