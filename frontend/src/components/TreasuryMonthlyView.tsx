import { useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { TreasuryForecast } from '../services/treasuryService';
import api from '../services/apiClient';
import { Payment } from '../services/paymentService';
import {
  buildMonthlyTreasuryData,
  SelectedStages,
  TreasuryExpense
} from '../domain/treasury/treasuryCalculations';

// Étendre l'interface pour inclure stage
interface OpportunityWithStage {
  id: string;
  amount: number | null;
  expectedPaymentDate: string;
  taxRate: number | null;
  stage?: string;
}

interface TreasuryMonthlyViewProps {
  startDate: Date;
  endDate: Date;
  currentBalance: number;
  forecast: TreasuryForecast | null;
  payments: Payment[];
  expenses: TreasuryExpense[];
  // Opportunités complètes (pour les libellés avec client)
  opportunities?: Array<{
    id: string;
    title: string;
    company?: { name: string } | null;
    contact?: { firstName: string; lastName?: string } | null;
  }>;
  // Étapes sélectionnées (filtres de la page Trésorerie)
  selectedStages?: SelectedStages;
  // Date d'ancre de projection (même logique que le graphique)
  projectionAnchorDate?: Date | null;
  // Solde manuel au jour d'ancre (pour rebasage éventuel)
  anchorBalance?: number | null;
}

interface MonthlyData {
  month: string;
  monthKey: string;
  soldeInitial: number;
  encaissementsPrevisionnels: number;
  encaissementsReels: number;
  decaissements: number;
  taxes: number;
  soldeFinal: number;
}

type EncaissementDetailType = 'previsionnel' | 'reel' | 'debours';
type DecaissementDetailType = 'depense' | 'taxe';

interface EncaissementDetail {
  type: EncaissementDetailType;
  label: string;
  amount: number;
  opportunityId?: string;
  paymentId?: string;
  deboursNoteId?: string;
}

interface DecaissementDetail {
  type: DecaissementDetailType;
  label: string;
  amount: number;
  expenseId?: string;
  paymentId?: string;
}

export function TreasuryMonthlyView({
  startDate,
  endDate,
  currentBalance,
  forecast,
  payments,
  expenses,
  opportunities = [],
  selectedStages,
  projectionAnchorDate,
  anchorBalance
}: TreasuryMonthlyViewProps) {
  const navigate = useNavigate();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'encaissements' | 'decaissements'>('all');
  const [detailModal, setDetailModal] = useState<{
    kind: 'encaissement' | 'decaissement';
    item: EncaissementDetail | DecaissementDetail;
  } | null>(null);

  const toggleRow = (monthKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedRows(newExpanded);
  };

  const monthlyData = useMemo(() => {
    const data = buildMonthlyTreasuryData({
      startDate,
      endDate,
      periodInitialBalance: currentBalance,
      projectionAnchorDate: projectionAnchorDate ?? null,
      anchorBalance: anchorBalance ?? null,
      forecast,
      payments,
      expenses,
      selectedStages: selectedStages ?? new Set<string>(['CLOSED_WON', 'FINALIZED'])
    });

    return data.map((month: any) => ({
      month: new Date(`${month.monthKey}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      monthKey: month.monthKey,
      soldeInitial: month.soldeInitial,
      encaissementsPrevisionnels: month.encaissementsPrevisionnels,
      encaissementsReels: month.encaissementsReels,
      decaissements: month.decaissements,
      taxes: month.taxes,
      soldeFinal: month.solde
    })) as MonthlyData[];
  }, [startDate, endDate, currentBalance, forecast, payments, expenses, selectedStages, projectionAnchorDate, anchorBalance]);

  // Filtrer les données selon le filtre de type
  const filteredMonthlyData = useMemo(() => {
    if (filterType === 'all') return monthlyData;
    return monthlyData.filter(month => {
      if (filterType === 'encaissements') {
        return month.encaissementsPrevisionnels > 0 || month.encaissementsReels > 0;
      } else if (filterType === 'decaissements') {
        return month.decaissements > 0 || month.taxes > 0;
      }
      return true;
    });
  }, [monthlyData, filterType]);

  // Obtenir les détails d'un mois pour l'affichage expansible
  const getMonthDetails = (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const details = {
      encaissements: [] as EncaissementDetail[],
      decaissements: [] as DecaissementDetail[]
    };

    // Somme des paiements réels par opportunité (toutes dates confondues)
    const totalPaidByOpportunity = new Map<string, number>();
    payments.forEach(payment => {
      if (payment.opportunityId) {
        const prev = totalPaidByOpportunity.get(payment.opportunityId) || 0;
        totalPaidByOpportunity.set(payment.opportunityId, prev + Number(payment.amount));
      }
    });

    // Encaissements prévisionnels - opportunités
    forecast?.opportunities.forEach(opp => {
      if (!opp.expectedPaymentDate || !opp.amount || opp.stage === 'FINALIZED') return;
      // Respecter le filtre d'étapes
      if (selectedStages && opp.stage && !selectedStages.has(opp.stage)) return;
      const paymentDate = new Date(opp.expectedPaymentDate);
      if (paymentDate >= monthStart && paymentDate <= monthEnd) {
        const montantTotal = Number(opp.amount) || 0;
        const advancePayments = forecast?.advancePaymentsByOpportunity?.[opp.id] || 0;
        const paidAmount = totalPaidByOpportunity.get(opp.id) || 0;
        const montantRestant = montantTotal - advancePayments - paidAmount;
        if (montantRestant <= 0) return;

        // Construire un libellé riche : Opportunité – Client – Contact
        const fullOpp = opportunities.find(o => o.id === opp.id);
        const companyName = fullOpp?.company?.name;
        const contactName = fullOpp?.contact
          ? `${fullOpp.contact.firstName} ${fullOpp.contact.lastName ?? ''}`.trim()
          : undefined;

        const parts: string[] = [];
        if (fullOpp?.title || opp.title) parts.push(fullOpp?.title || opp.title);
        if (companyName) parts.push(companyName);
        if (contactName) parts.push(contactName);

        details.encaissements.push({
          type: 'previsionnel',
          label: parts.length > 0 ? parts.join(' – ') : (opp.title || 'Opportunité'),
          amount: montantRestant,
          opportunityId: opp.id
        });
      }
    });

    // Encaissements prévisionnels - notes de débours
    (forecast?.deboursNotesForecast || []).forEach(debours => {
      if (!debours.expectedPaymentDate || !debours.totalFrais) return;
      const paymentDate = new Date(debours.expectedPaymentDate);
      if (paymentDate >= monthStart && paymentDate <= monthEnd) {
        const hasRealPayment = payments.some(p => p.deboursNoteId === debours.id &&
          new Date(p.paymentDate) >= monthStart && new Date(p.paymentDate) <= monthEnd);
        if (!hasRealPayment) {
          details.encaissements.push({
            type: 'debours',
            label: debours.title || 'Note de débours',
            amount: Number(debours.totalFrais),
            deboursNoteId: debours.id,
            opportunityId: debours.opportunityId
          });
        }
      }
    });

    // Encaissements réels
    payments.forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      if (paymentDate >= monthStart && paymentDate <= monthEnd) {
        details.encaissements.push({
          type: 'reel',
          label: payment.opportunity?.title || payment.deboursNote?.title || 'Paiement',
          amount: payment.amount,
          opportunityId: payment.opportunityId,
          paymentId: payment.id,
          deboursNoteId: payment.deboursNoteId
        });
      }
    });

    // Décaissements - dépenses
    expenses.forEach(expense => {
      if (!expense.invoiceDate) return;
      const expenseDate = new Date(expense.invoiceDate);
      if (expenseDate >= monthStart && expenseDate <= monthEnd) {
        const amount = expense.amountTTC || expense.amountHT || 0;
        details.decaissements.push({
          type: 'depense',
          label: 'Dépense',
          amount: Number(amount),
          expenseId: (expense as any).id
        });
      }
    });

    // Taxes (du mois suivant les paiements)
    payments.forEach(payment => {
      const paymentDate = new Date(payment.paymentDate);
      const taxDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 30);
      if (taxDate >= monthStart && taxDate <= monthEnd) {
        details.decaissements.push({
          type: 'taxe',
          label: `Taxes (paiement ${new Date(payment.paymentDate).toLocaleDateString('fr-FR')})`,
          amount: payment.taxAmount,
          paymentId: payment.id,
          opportunityId: payment.opportunityId
        });
      }
    });

    return details;
  };

  const handleEncaissementClick = (item: EncaissementDetail) => {
    if (item.opportunityId || item.deboursNoteId) {
      setDetailModal({ kind: 'encaissement', item });
    }
  };

  const handleDecaissementClick = (item: DecaissementDetail) => {
    if (item.expenseId || item.paymentId) {
      setDetailModal({ kind: 'decaissement', item });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleNavigateFromModal = () => {
    if (!detailModal) return;
    const { kind, item } = detailModal;

    if (kind === 'encaissement') {
      const enc = item as EncaissementDetail;
      if (enc.opportunityId) {
        navigate(`/opportunites/${enc.opportunityId}`);
        setDetailModal(null);
        return;
      }
      if (enc.deboursNoteId) {
        // Pas encore de route dédiée notes de débours
        return;
      }
    } else {
      const dec = item as DecaissementDetail;
      if (dec.expenseId) {
        navigate(`/depenses/${dec.expenseId}`);
        setDetailModal(null);
        return;
      }
      if (dec.paymentId) {
        const payment = payments.find((p) => p.id === dec.paymentId);
        if (payment?.opportunityId) {
          navigate(`/opportunites/${payment.opportunityId}`);
          setDetailModal(null);
          return;
        }
      }
    }
  };

  const hasNavigationTarget = (item: EncaissementDetail | DecaissementDetail, kind: 'encaissement' | 'decaissement') => {
    if (kind === 'encaissement') {
      const enc = item as EncaissementDetail;
      return !!(enc.opportunityId || enc.deboursNoteId);
    }
    const dec = item as DecaissementDetail;
    return !!(dec.expenseId || dec.paymentId);
  };

  return (
    <div>
      {/* Filtres */}
      <div className="mb-4 flex items-center space-x-4">
        <label className="text-sm font-medium text-slate-700">Filtrer par type :</label>
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 rounded text-sm ${filterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilterType('encaissements')}
          className={`px-3 py-1 rounded text-sm ${filterType === 'encaissements' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Encaissements
        </button>
        <button
          onClick={() => setFilterType('decaissements')}
          className={`px-3 py-1 rounded text-sm ${filterType === 'decaissements' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Décaissements
        </button>
      </div>

      <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: '40px' }}>
              {/* Espace pour l'icône d'expansion */}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Mois
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Solde initial
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Encaissements prévisionnels
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Encaissements réels
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Décaissements
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Taxes
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
              Solde final
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {filteredMonthlyData.map((month) => {
            const isExpanded = expandedRows.has(month.monthKey);
            const details = getMonthDetails(month.monthKey);
            const hasDetails = details.encaissements.length > 0 || details.decaissements.length > 0;

            return (
              <>
                <tr key={month.monthKey} className={month.soldeFinal < 0 ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {hasDetails && (
                      <button
                        onClick={() => toggleRow(month.monthKey)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                    {month.month}
                  </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-600">
                {formatCurrency(month.soldeInitial)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-600">
                {formatCurrency(month.encaissementsPrevisionnels)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-700 font-medium">
                {formatCurrency(month.encaissementsReels)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-600">
                {formatCurrency(month.decaissements)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-orange-600">
                {formatCurrency(month.taxes)}
              </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${month.soldeFinal < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {formatCurrency(month.soldeFinal)}
                  </td>
                </tr>
                {isExpanded && hasDetails && (
                  <tr key={`${month.monthKey}-detail`} className="bg-slate-50">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Encaissements */}
                        <div>
                          <h4 className="font-semibold text-green-700 mb-2">Encaissements</h4>
                          <div className="space-y-1 text-sm">
                            {details.encaissements.length > 0 ? (
                              details.encaissements.map((item, idx) => {
                                const clickable = hasNavigationTarget(item, 'encaissement');
                                return (
                                  <div key={idx} className="flex justify-between">
                                    {clickable ? (
                                      <button
                                        type="button"
                                        onClick={() => handleEncaissementClick(item)}
                                        className="text-left text-slate-600 hover:underline hover:text-indigo-700"
                                      >
                                        {item.label}
                                      </button>
                                    ) : (
                                      <span className="text-slate-600">{item.label}</span>
                                    )}
                                    <span className="font-medium text-green-600">{formatCurrency(item.amount)}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-slate-400 italic">Aucun encaissement</p>
                            )}
                          </div>
                        </div>
                        {/* Décaissements */}
                        <div>
                          <h4 className="font-semibold text-red-700 mb-2">Décaissements</h4>
                          <div className="space-y-1 text-sm">
                            {details.decaissements.length > 0 ? (
                              details.decaissements.map((item, idx) => {
                                const clickable = hasNavigationTarget(item, 'decaissement');
                                return (
                                  <div key={idx} className="flex justify-between">
                                    {clickable ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDecaissementClick(item)}
                                        className="text-left text-slate-600 hover:underline hover:text-indigo-700"
                                      >
                                        {item.label}
                                      </button>
                                    ) : (
                                      <span className="text-slate-600">{item.label}</span>
                                    )}
                                    <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-slate-400 italic">Aucun décaissement</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
      </div>

      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {detailModal.kind === 'encaissement' ? 'Détail encaissement' : 'Détail décaissement'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {detailModal.item.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 text-sm text-slate-700">
              <p className="flex justify-between">
                <span>Montant</span>
                <span className="font-semibold">
                  {formatCurrency(detailModal.item.amount)}
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Fermer
              </button>
              {hasNavigationTarget(detailModal.item, detailModal.kind) && (
                <button
                  type="button"
                  onClick={handleNavigateFromModal}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Ouvrir la fiche liée
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

