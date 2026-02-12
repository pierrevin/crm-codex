import { BanknotesIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Invoice } from '../services/invoiceService';
import { Payment } from '../services/paymentService';

interface PaymentSummaryProps {
  opportunityAmount?: number;
  invoices?: Invoice[];
  payments?: Payment[];
}

export function PaymentSummary({
  opportunityAmount = 0,
  invoices = [],
  payments = []
}: PaymentSummaryProps) {
  // Calculer le total facturé (somme de toutes les factures)
  const totalInvoiced = invoices.reduce((sum, invoice) => {
    return sum + Number(invoice.amountTTC || 0);
  }, 0);

  // Calculer le total payé (somme de tous les paiements)
  const totalPaid = payments.reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);

  // Calculer le reste à encaisser
  // On se base en priorité sur le montant de l'opportunité (objectif global),
  // et à défaut sur le total facturé si aucune opportunité n'a de montant.
  const targetAmount = opportunityAmount || totalInvoiced;
  const remainingToCollect = Math.max(0, targetAmount - totalPaid);

  // Calculer le pourcentage payé
  const paidPercentage = targetAmount > 0 ? (totalPaid / targetAmount) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Si aucune donnée, ne rien afficher
  if (opportunityAmount === 0 && invoices.length === 0 && payments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">État des paiements</h2>
      
      {/* Cartes de métriques */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Total facturé */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BanknotesIcon className="h-5 w-5 text-indigo-600" />
            <p className="text-xs font-medium text-indigo-700">Total facturé</p>
          </div>
          <p className="text-xl font-bold text-indigo-900">
            {formatCurrency(totalInvoiced)}
          </p>
          {invoices.length > 0 && (
            <p className="text-xs text-indigo-600 mt-1">
              {invoices.length} facture{invoices.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Total payé */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            <p className="text-xs font-medium text-emerald-700">Total payé</p>
          </div>
          <p className="text-xl font-bold text-emerald-900">
            {formatCurrency(totalPaid)}
          </p>
          {payments.length > 0 && (
            <p className="text-xs text-emerald-600 mt-1">
              {payments.length} paiement{payments.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Reste à encaisser */}
        <div className={`rounded-lg border p-4 ${
          remainingToCollect > 0
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className={`h-5 w-5 ${
              remainingToCollect > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`} />
            <p className={`text-xs font-medium ${
              remainingToCollect > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              Reste à encaisser
            </p>
          </div>
          <p className={`text-xl font-bold ${
            remainingToCollect > 0 ? 'text-amber-900' : 'text-emerald-900'
          }`}>
            {formatCurrency(remainingToCollect)}
          </p>
          {targetAmount > 0 && (
            <p className={`text-xs mt-1 ${
              remainingToCollect > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {paidPercentage.toFixed(1)}% payé
            </p>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      {targetAmount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Progression du paiement</span>
            <span className="text-sm text-slate-500">
              {formatCurrency(totalPaid)} / {formatCurrency(targetAmount)}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                remainingToCollect === 0 ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, paidPercentage)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
