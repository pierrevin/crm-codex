import { useEffect, useMemo, useState } from 'react';
import { PlusIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EffectiveSale, EffectiveSaleSource, EffectiveSaleStatus, effectiveSalesService } from '../services/effectiveSalesService';

type PeriodPreset = '30d' | '90d' | 'ytd';
type Scope = 'all' | 'off_pipe';

const EFFECTIVE_SALES_COLLAPSE_KEY = 'effectiveSales.section.collapsed.v1';

function formatCurrency(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

function sumAmount(items: EffectiveSale[]) {
  return items.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

export function EffectiveSalesSection(props: { companyId?: string | null; opportunityId?: string | null }) {
  const { companyId } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<EffectiveSale[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(EFFECTIVE_SALES_COLLAPSE_KEY);
      return raw ? JSON.parse(raw) === true : true; // par défaut: replié
    } catch {
      return true;
    }
  });

  const [period, setPeriod] = useState<PeriodPreset>('ytd');
  const [scope, setScope] = useState<Scope>('all');
  const [status, setStatus] = useState<EffectiveSaleStatus | ''>('');
  const [startDate, setStartDate] = useState<string>(() => {
    // Par défaut: année civile en cours (YTD)
    return toDateInputValue(startOfYear(new Date()));
  });
  const [endDate, setEndDate] = useState<string>(() => toDateInputValue(new Date()));

  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState<string>(() => toDateInputValue(new Date()));
  const [createAmount, setCreateAmount] = useState<string>('');
  const [createLabel, setCreateLabel] = useState<string>('');
  const [createStatus, setCreateStatus] = useState<EffectiveSaleStatus>('CONFIRMED');

  useEffect(() => {
    try {
      localStorage.setItem(EFFECTIVE_SALES_COLLAPSE_KEY, JSON.stringify(isCollapsed));
    } catch {
      // no-op
    }
  }, [isCollapsed]);

  // Sync dates when preset changes
  useEffect(() => {
    const now = new Date();
    if (period === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      setStartDate(toDateInputValue(d));
      setEndDate(toDateInputValue(now));
    }
    if (period === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      setStartDate(toDateInputValue(d));
      setEndDate(toDateInputValue(now));
    }
    if (period === 'ytd') {
      setStartDate(toDateInputValue(startOfYear(now)));
      setEndDate(toDateInputValue(now));
    }
  }, [period]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Parameters<typeof effectiveSalesService.getAll>[0] = {
        startDate,
        endDate,
        limit: 500
      };
      if (companyId) filters.companyId = companyId;
      if (status) filters.status = status;
      if (scope === 'off_pipe') filters.source = 'OFF_PIPE';
      const data = await effectiveSalesService.getAll(filters);
      setSales(data);
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement ventes effectives');
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, startDate, endDate, scope, status]);

  const totals = useMemo(() => {
    const offPipe = sales.filter(s => s.source === 'OFF_PIPE');
    return {
      total: sumAmount(sales),
      offPipe: sumAmount(offPipe)
    };
  }, [sales]);

  const statusBadgeVariant = (s: EffectiveSaleStatus) => {
    if (s === 'PAID') return 'paid';
    if (s === 'INVOICED') return 'processed';
    return 'pending';
  };

  const sourceLabel = (s: EffectiveSaleSource) => (s === 'OPPORTUNITY' ? 'Opportunité' : 'Hors opportunité');

  const handleCreate = async () => {
    if (!companyId) return;
    const amount = Number(createAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    setLoading(true);
    setError(null);
    try {
      await effectiveSalesService.create({
        companyId,
        opportunityId: null,
        source: 'OFF_PIPE',
        status: createStatus,
        effectiveDate: new Date(createDate).toISOString(),
        amount,
        label: createLabel || null
      });
      setShowCreate(false);
      setCreateAmount('');
      setCreateLabel('');
      setCreateStatus('CONFIRMED');
      setCreateDate(toDateInputValue(new Date()));
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Erreur création vente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Ventes effectives</h2>
          <p className="text-sm text-slate-500">
            Opportunités gagnées/finalisées + ventes hors opportunité{companyId ? ' (entreprise filtrée)' : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title={isCollapsed ? 'Afficher le détail' : 'Masquer le détail'}
          >
            {isCollapsed ? (
              <>
                <ChevronDownIcon className="h-5 w-5" />
                Afficher le détail
              </>
            ) : (
              <>
                <ChevronUpIcon className="h-5 w-5" />
                Masquer le détail
              </>
            )}
          </button>
          <Button
            type="button"
            onClick={() => setShowCreate(true)}
            variant="primary"
            icon={<PlusIcon className="w-5 h-5" />}
            disabled={!companyId}
          >
            Ajouter vente hors opportunité
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-600 mb-1">Total (année en cours)</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(totals.total)}</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs font-medium text-indigo-700 mb-1">Dont hors opportunité</p>
          <p className="text-lg font-bold text-indigo-900">{formatCurrency(totals.offPipe)}</p>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Filtres */}
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Période</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="30d">30 jours</option>
                  <option value="90d">90 jours</option>
                  <option value="ytd">YTD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Périmètre</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Scope)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="all">{companyId ? 'Toutes (entreprise)' : 'Toutes (global)'}</option>
                  <option value="off_pipe">Hors opportunité</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EffectiveSaleStatus | '')}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">Tous</option>
                  <option value="CONFIRMED">Confirmé</option>
                  <option value="INVOICED">Facturé</option>
                  <option value="PAID">Encaissé</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tableau */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-slate-500" colSpan={5}>
                      Chargement…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-rose-600" colSpan={5}>
                      {error}
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={5}>
                      Aucune vente effective sur la période.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className="text-sm text-slate-700 hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.effectiveDate ? new Date(s.effectiveDate).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{sourceLabel(s.source)}</td>
                      <td className="px-4 py-3">
                        {s.source === 'OPPORTUNITY' && s.opportunity ? (
                          <span className="text-slate-900">{s.opportunity.title}</span>
                        ) : (
                          <span className="text-slate-900">{s.label || s.externalRef || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                        {formatCurrency(Number(s.amount) || 0, s.currency || 'EUR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={statusBadgeVariant(s.status)}>{s.status === 'PAID' ? 'Encaissé' : s.status === 'INVOICED' ? 'Facturé' : 'Confirmé'}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal création simple */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Ajouter une vente hors opportunité</h3>
                <p className="text-sm text-slate-500">
                  {companyId ? 'Elle sera rattachée à l’entreprise sélectionnée.' : 'Sélectionne d’abord une entreprise dans le filtre au-dessus.'}
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  placeholder="ex: 1200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Libellé (optionnel)</label>
                <input
                  type="text"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  placeholder="ex: Prestation hors CRM"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as EffectiveSaleStatus)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="CONFIRMED">Confirmé</option>
                  <option value="INVOICED">Facturé</option>
                  <option value="PAID">Encaissé</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button type="button" variant="primary" onClick={handleCreate} disabled={!companyId}>
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

