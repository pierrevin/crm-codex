import { useState, useEffect } from 'react';
import { RecurringExpense, RecurrenceType, UpdateRecurringExpenseDto } from '../services/recurringExpensesService';
import { AccountCodeSelector } from './AccountCodeSelector';

interface RecurringExpenseEditFormProps {
  recurring: RecurringExpense;
  onSave: (updates: UpdateRecurringExpenseDto) => void;
  onCancel: () => void;
}

export function RecurringExpenseEditForm({ recurring, onSave, onCancel }: RecurringExpenseEditFormProps) {
  const [supplierName, setSupplierName] = useState(recurring.supplierName || '');
  const [amountHT, setAmountHT] = useState(recurring.amountHT?.toString() || '');
  const [amountTTC, setAmountTTC] = useState(recurring.amountTTC?.toString() || '');
  const [vatRate, setVatRate] = useState(recurring.vatRate ? (recurring.vatRate * 100).toFixed(2) : '20');
  const [vatAmount, setVatAmount] = useState(recurring.vatAmount?.toString() || '');
  const [accountCode, setAccountCode] = useState(recurring.accountCode || '');
  const [accountLabel, setAccountLabel] = useState(recurring.accountLabel || '');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(recurring.recurrenceType);
  const [paymentDay, setPaymentDay] = useState(recurring.paymentDay.toString());
  const [startDate, setStartDate] = useState(recurring.startDate ? new Date(recurring.startDate).toISOString().split('T')[0] : '');
  const [endDate, setEndDate] = useState(recurring.endDate ? new Date(recurring.endDate).toISOString().split('T')[0] : '');
  const [isActive, setIsActive] = useState(recurring.isActive);
  const [notes, setNotes] = useState(recurring.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const updates: UpdateRecurringExpenseDto = {
        supplierName: supplierName || undefined,
        amountHT: amountHT ? parseFloat(amountHT) : undefined,
        amountTTC: amountTTC ? parseFloat(amountTTC) : undefined,
        vatRate: vatRate ? parseFloat(vatRate) / 100 : undefined,
        vatAmount: vatAmount ? parseFloat(vatAmount) : undefined,
        accountCode: accountCode || undefined,
        accountLabel: accountLabel || undefined,
        recurrenceType,
        paymentDay: parseInt(paymentDay, 10),
        startDate: startDate ? new Date(startDate + 'T00:00:00').toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T00:00:00').toISOString() : undefined,
        isActive,
        notes: notes || undefined,
      };
      
      onSave(updates);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fournisseur</label>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Montant TTC</label>
          <input
            type="number"
            step="0.01"
            value={amountTTC}
            onChange={(e) => setAmountTTC(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type de récurrence</label>
          <select
            value={recurrenceType}
            onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          >
            <option value="WEEKLY">Hebdomadaire</option>
            <option value="MONTHLY">Mensuel</option>
            <option value="QUARTERLY">Trimestriel</option>
            <option value="YEARLY">Annuel</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Jour de paiement</label>
          <input
            type="number"
            min="1"
            max="31"
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin (optionnel)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Code compte</label>
          <AccountCodeSelector
            value={accountCode}
            onChange={(code, label) => {
              setAccountCode(code);
              setAccountLabel(label);
            }}
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
            Actif
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-md"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

