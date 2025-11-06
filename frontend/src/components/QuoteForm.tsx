import { useState, useEffect } from 'react';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

type QuoteItem = {
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
};

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
  items: QuoteItem[];
};

type QuoteFormProps = {
  quote?: Quote;
  opportunityId?: string;
  companyId?: string;
  onSubmit: (quote: Quote) => Promise<void>;
  onCancel: () => void;
};

const UNITS = ['heures', 'unités', 'jours', 'mois', 'pièce', 'forfait'];
const TAX_RATES = [
  { value: 0.2, label: '20%' },
  { value: 0.1, label: '10%' },
  { value: 0.085, label: '8.5%' },
  { value: 0.055, label: '5.5%' },
  { value: 0.021, label: '2.1%' },
  { value: 0, label: '0%' }
];

export function QuoteForm({ quote, opportunityId, companyId, onSubmit, onCancel }: QuoteFormProps) {
  const [formData, setFormData] = useState<Quote>({
    label: quote?.label || '',
    quoteNumber: quote?.quoteNumber || '',
    issueDate: quote?.issueDate || new Date().toISOString().split('T')[0],
    validityEndDate: quote?.validityEndDate || '',
    freeField: quote?.freeField || '',
    status: quote?.status || 'DRAFT',
    opportunityId: quote?.opportunityId || opportunityId,
    companyId: quote?.companyId || companyId,
    items: quote?.items || [{
      label: '',
      quantity: 1,
      unit: 'heures',
      unitPriceHT: 0,
      taxRate: 0,
      order: 0
    }]
  });

  // Mettre à jour le formData quand la prop quote change (pour le pré-remplissage)
  useEffect(() => {
    console.log('[QuoteForm] quote prop changed:', quote);
    if (quote) {
      const itemsWithTotals = quote.items && quote.items.length > 0 
        ? quote.items.map(item => ({
            ...item,
            totalHT: item.totalHT || (item.quantity * item.unitPriceHT - (item.discountAmount || 0))
          }))
        : [{
            label: '',
            quantity: 1,
            unit: 'heures',
            unitPriceHT: 0,
            taxRate: 0,
            order: 0
          }];
      
      const newFormData = {
        label: quote.label || '',
        quoteNumber: quote.quoteNumber || '',
        issueDate: quote.issueDate || new Date().toISOString().split('T')[0],
        validityEndDate: quote.validityEndDate || '',
        freeField: quote.freeField || '',
        status: quote.status || 'DRAFT',
        opportunityId: quote.opportunityId || opportunityId,
        companyId: quote.companyId || companyId,
        items: itemsWithTotals
      };
      
      console.log('[QuoteForm] Mise à jour formData avec:', newFormData);
      setFormData(newFormData);
    } else if (!quote && opportunityId) {
      // Si pas de quote mais qu'on a une opportunityId, on attend que quote soit chargé
      // Ne rien faire ici, le QuoteDetailPage va charger et passer quote
      console.log('[QuoteForm] Pas de quote mais opportunityId présent, en attente...');
    }
  }, [quote, opportunityId, companyId]);

  const calculateItemTotal = (item: QuoteItem): number => {
    const subtotal = item.quantity * item.unitPriceHT;
    const discount = item.discountAmount || 0;
    return subtotal - discount;
  };

  const calculateQuoteTotals = (items: QuoteItem[]): { totalHT: number; totalTTC: number } => {
    let totalHT = 0;
    let maxTaxRate = 0;

    items.forEach((item) => {
      const itemHT = calculateItemTotal(item);
      totalHT += itemHT;
      if (item.taxRate > maxTaxRate) {
        maxTaxRate = item.taxRate;
      }
    });

    const totalTTC = totalHT * (1 + maxTaxRate);
    return { totalHT, totalTTC };
  };

  useEffect(() => {
    // Recalculer les totaux quand les items changent
    const itemsWithTotals = formData.items.map((item, index) => ({
      ...item,
      totalHT: calculateItemTotal(item),
      order: index
    }));
    
    if (JSON.stringify(itemsWithTotals.map(i => i.totalHT)) !== JSON.stringify(formData.items.map(i => i.totalHT))) {
      setFormData(prev => ({
        ...prev,
        items: itemsWithTotals
      }));
    }
  }, [formData.items]);

  const handleItemChange = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculer le total HT de la ligne
    if (field === 'quantity' || field === 'unitPriceHT' || field === 'discountAmount') {
      newItems[index].totalHT = calculateItemTotal(newItems[index]);
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          label: '',
          quantity: 1,
          unit: 'heures',
          unitPriceHT: 0,
          taxRate: 0.2,
          order: formData.items.length
        }
      ]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) {
      alert('Un devis doit avoir au moins une ligne');
      return;
    }
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.label || !formData.issueDate) {
      alert('Le libellé et la date d\'émission sont obligatoires');
      return;
    }

    if (formData.items.length === 0 || formData.items.some(item => !item.label || item.quantity <= 0 || item.unitPriceHT <= 0)) {
      alert('Tous les items doivent avoir un libellé, une quantité et un prix unitaire');
      return;
    }

    await onSubmit(formData);
  };

  const { totalHT, totalTTC } = calculateQuoteTotals(formData.items);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informations générales */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-lg font-semibold mb-4">Informations du devis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Libellé du devis *
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              maxLength={255}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Numéro de devis
            </label>
            <input
              type="text"
              value={formData.quoteNumber}
              onChange={(e) => setFormData({ ...formData, quoteNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date d'émission *
            </label>
            <input
              type="date"
              value={formData.issueDate}
              onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date de fin de validité
            </label>
            <input
              type="date"
              value={formData.validityEndDate}
              onChange={(e) => setFormData({ ...formData, validityEndDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Quote['status'] })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="DRAFT">Brouillon</option>
              <option value="SENT">Envoyé</option>
              <option value="ACCEPTED">Accepté</option>
              <option value="REJECTED">Refusé</option>
              <option value="EXPIRED">Expiré</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Champ libre
            </label>
            <textarea
              value={formData.freeField}
              onChange={(e) => setFormData({ ...formData, freeField: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Lignes de devis */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Lignes de devis *</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Ajouter une ligne
          </button>
        </div>

        <div className="space-y-4">
          {formData.items.map((item, index) => (
            <div key={index} className="p-4 border border-slate-200 rounded-md">
              <div className="flex justify-between items-start mb-3">
                <span className="text-sm font-medium text-slate-700">Ligne {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-600 hover:text-red-800"
                  disabled={formData.items.length <= 1}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Libellé *
                  </label>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unité *
                  </label>
                  <select
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {UNITS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Prix unitaire HT (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPriceHT}
                    onChange={(e) => handleItemChange(index, 'unitPriceHT', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Remise (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.discountAmount || ''}
                    onChange={(e) => handleItemChange(index, 'discountAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Taux TVA *
                  </label>
                  <select
                    value={item.taxRate}
                    onChange={(e) => handleItemChange(index, 'taxRate', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {TAX_RATES.map(rate => (
                      <option key={rate.value} value={rate.value}>{rate.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Total HT (€)
                  </label>
                  <input
                    type="number"
                    value={item.totalHT?.toFixed(2) || '0.00'}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-600"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={item.description || ''}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totaux */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-end space-x-8">
          <div className="text-right">
            <div className="text-sm text-slate-600 mb-1">Total HT</div>
            <div className="text-2xl font-bold text-slate-900">{totalHT.toFixed(2)} €</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600 mb-1">Total TTC</div>
            <div className="text-2xl font-bold text-indigo-600">{totalTTC.toFixed(2)} €</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
        >
          {quote?.id ? 'Enregistrer' : 'Créer le devis'}
        </button>
      </div>
    </form>
  );
}

