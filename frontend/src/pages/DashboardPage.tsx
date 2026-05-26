import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  PlusIcon, 
  UserGroupIcon, 
  BuildingOfficeIcon, 
  BriefcaseIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CloudIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell } from 'recharts';
import api from '../services/apiClient';
import { ProjectionView } from '../components/ProjectionView';
import { PipelineByStageView } from '../components/PipelineByStageView';
import { GlobalSearch } from '../components/GlobalSearch';
import {
  computeDashboardStats,
  type RawDashboardData
} from '../utils/computeDashboardStats';

type DashboardPreset = 'MONTH' | 'QUARTER' | 'YEAR' | 'LAST_12_MONTHS' | 'ALL' | 'CUSTOM';

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-500' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-500' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-500' },
  FINALIZED: { label: 'Finalisé / réglé', color: 'bg-amber-500' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-500' }
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rawData, setRawData] = useState<RawDashboardData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [filterPreset, setFilterPreset] = useState<DashboardPreset>('YEAR');
  const [filterDateFrom, setFilterDateFrom] = useState<string | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<string | undefined>();
  const [filterStages, setFilterStages] = useState<Set<string>>(
    () => new Set(Object.keys(STAGES))
  );
  
  useEffect(() => {
    void checkGoogleConnection();
    
    // Afficher un message si Google OAuth callback
    const google = searchParams.get('google');
    const message = searchParams.get('message');
    if (google === 'connected') {
      // Afficher un toast de succès (on peut ajouter un système de toast plus tard)
      console.log('Google OAuth: Connexion réussie');
      setGoogleConnected(true);
      // Nettoyer les paramètres après affichage
      setSearchParams({}, { replace: true });
    } else if (google === 'error') {
      // Afficher un message d'erreur
      alert(`Erreur Google OAuth: ${message || 'Erreur inconnue'}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    // Initialiser la période par défaut (année en cours) si non définie
    if (!filterDateFrom && !filterDateTo && filterPreset === 'YEAR') {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      const to = now;
      setFilterDateFrom(from.toISOString().slice(0, 10));
      setFilterDateTo(to.toISOString().slice(0, 10));
      return;
    }
  }, [filterDateFrom, filterDateTo, filterPreset]);

  const filterStagesKey = useMemo(
    () => Array.from(filterStages).sort().join(','),
    [filterStages]
  );

  const canApplyGlobalPeriod =
    filterPreset === 'ALL' || Boolean(filterDateFrom && filterDateTo);

  const computed = useMemo(() => {
    if (!rawData || !canApplyGlobalPeriod) return null;
    return computeDashboardStats(rawData, filterStages, filterDateFrom, filterDateTo);
  }, [rawData, filterStagesKey, filterDateFrom, filterDateTo, canApplyGlobalPeriod]);

  const stats = computed ?? {
    totalContacts: 0,
    totalCompanies: 0,
    totalOpportunities: 0,
    pipelineValue: 0,
    wonValue: 0,
    netRevenue: 0,
    averageTaxRate: 0.27,
    opportunitiesByStage: {} as Record<string, number>,
    recentOpportunities: [] as any[],
    filteredOpportunities: [] as any[],
    stageFilteredOpportunities: [] as any[]
  };

  const revenueStats = computed?.revenueStats ?? null;

  useEffect(() => {
    if (!canApplyGlobalPeriod) return;
    if (rawData) return;
    void fetchDashboardData();
  }, [canApplyGlobalPeriod, rawData]);

  const checkGoogleConnection = async () => {
    try {
      const { data } = await api.get('/api/google/connected');
      setGoogleConnected(data.connected === true);
    } catch (error) {
      // Si erreur, considérer comme non connecté
      console.error('Erreur vérification connexion Google:', error);
      setGoogleConnected(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [contactsRes, companiesRes, opportunitiesRes, paymentsRes] = await Promise.all([
        api.get('/api/contacts', { params: { limit: 1000 } }),
        api.get('/api/companies'),
        api.get('/api/opportunities', { params: { limit: 1000 } }),
        api.get('/api/payments', { params: { limit: 1000 } })
      ]);

      const companies = Array.isArray(companiesRes.data)
        ? companiesRes.data
        : companiesRes.data.items || companiesRes.data.data || [];
      const opportunities = opportunitiesRes.data.items || opportunitiesRes.data.data || [];
      const payments = paymentsRes.data.items || paymentsRes.data.data || [];

      setRawData({
        totalContacts: contactsRes.data.total ?? (contactsRes.data.items?.length ?? 0),
        companiesCount: companies.length,
        opportunities,
        payments
      });
    } catch (error) {
      console.error('Erreur chargement stats côté frontend:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const connectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      // Récupérer l'userId depuis l'API
      const userRes = await api.get('/api/users/me');
      const userId = userRes.data.id;
      
      // Générer l'URL OAuth
      const { data } = await api.get('/api/google/auth-url');
      if (data.url) {
        // Rediriger vers Google OAuth avec le state (userId)
        window.location.href = `${data.url}&state=${userId}`;
      } else {
        alert('Erreur: Impossible de générer l\'URL OAuth');
        setConnectingGoogle(false);
      }
    } catch (error: any) {
      console.error('Erreur connexion Google:', error);
      alert(`Erreur: ${error.response?.data?.message || error.message || 'Erreur inconnue'}`);
      setConnectingGoogle(false);
    }
  };

  const wonForConversion =
    (stats.opportunitiesByStage['CLOSED_WON'] || 0) +
    (stats.opportunitiesByStage['FINALIZED'] || 0);

  const conversionRate = stats.totalOpportunities > 0 
    ? (wonForConversion / stats.totalOpportunities * 100).toFixed(1)
    : 0;

  const signedGross = revenueStats?.signed?.gross ?? 0;
  const signedNet = revenueStats?.signed?.net ?? 0;
  const invoicedGross = revenueStats?.invoiced?.gross ?? 0;
  const invoicedNet = revenueStats?.invoiced?.net ?? 0;
  const paidGross = revenueStats?.paid?.gross ?? 0;
  const paidNet = revenueStats?.paid?.net ?? 0;

  if (initialLoading) {
    return <div className="p-8 text-center text-slate-500">Chargement du tableau de bord...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec recherche globale + filtres */}
      <div className="space-y-4 sticky top-0 z-10 bg-slate-50/80 backdrop-blur border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Tableau de bord</h1>
            <p className="text-slate-500 mt-1">Vue d'ensemble de votre activité commerciale</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {googleConnected ? (
              <div className="flex items-center gap-2 text-sm text-green-600" title="Google Drive connecté">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Google Drive</span>
              </div>
            ) : (
              <button
                onClick={connectGoogle}
                disabled={connectingGoogle}
                className="flex items-center gap-2 rounded-md bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CloudIcon className="h-5 w-5" />
                {connectingGoogle ? 'Connexion...' : 'Connecter Google Drive'}
              </button>
            )}

            {/* Boutons \"Créer rapidement\" intégrés dans le header */}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => navigate('/entreprises/new')}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <PlusIcon className="h-4 w-4 text-indigo-600" />
                <span>Entreprise</span>
              </button>
              <button
                onClick={() => navigate('/contacts/new')}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <PlusIcon className="h-4 w-4 text-blue-600" />
                <span>Contact</span>
              </button>
              <button
                onClick={() => navigate('/opportunites/new')}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <PlusIcon className="h-4 w-4 text-purple-600" />
                <span>Opportunité</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-center">
            <GlobalSearch />
          </div>

          {/* Filtres globaux : KPI, tunnel, étapes pour toute la page */}
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500">
              Ces filtres s&apos;appliquent aux indicateurs, au tunnel et aux graphiques (étapes).
              Chaque graphique a sa propre période ci-dessous.
            </p>
            <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Période des indicateurs :</span>
              <select
                value={filterPreset}
                onChange={(e) => {
                  const value = e.target.value as DashboardPreset;
                  setFilterPreset(value);

                  const now = new Date();

                  if (value === 'CUSTOM') {
                    return;
                  }

                  if (value === 'ALL') {
                    setFilterDateFrom(undefined);
                    setFilterDateTo(undefined);
                    return;
                  }

                  let from: Date | undefined;
                  let to: Date | undefined = now;

                  switch (value) {
                    case 'MONTH': {
                      from = new Date(now.getFullYear(), now.getMonth(), 1);
                      break;
                    }
                    case 'QUARTER': {
                      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
                      from = new Date(now.getFullYear(), quarterStartMonth, 1);
                      break;
                    }
                    case 'YEAR': {
                      from = new Date(now.getFullYear(), 0, 1);
                      break;
                    }
                    case 'LAST_12_MONTHS': {
                      from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                      break;
                    }
                  }

                  setFilterDateFrom(from ? from.toISOString().slice(0, 10) : undefined);
                  setFilterDateTo(to ? to.toISOString().slice(0, 10) : undefined);
                }}
                className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
              >
                <option value="MONTH">Mois en cours</option>
                <option value="QUARTER">Trimestre en cours</option>
                <option value="YEAR">Année en cours</option>
                <option value="LAST_12_MONTHS">12 derniers mois</option>
                <option value="ALL">Tout l'historique</option>
                <option value="CUSTOM">Personnalisée</option>
              </select>
            </div>

            {filterPreset === 'CUSTOM' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Du :</span>
                  <input
                    type="date"
                    value={filterDateFrom || ''}
                    onChange={(e) => setFilterDateFrom(e.target.value || undefined)}
                    className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Au :</span>
                  <input
                    type="date"
                    value={filterDateTo || ''}
                    onChange={(e) => setFilterDateTo(e.target.value || undefined)}
                    className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white"
                  />
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Étapes (page entière) :</span>
              {Object.entries(STAGES).map(([stage, { label }]) => (
                <label key={stage} className="flex items-center gap-1 text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={filterStages.has(stage)}
                    onChange={(e) => {
                      setFilterStages(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) {
                          next.add(stage);
                        } else if (next.size > 1) {
                          next.delete(stage);
                        }
                        return next;
                      });
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-slate-700">{label}</span>
                </label>
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques principales - Pipeline + CA signé */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/entreprises"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 uppercase">Clients</p>
              <p className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Global
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalCompanies}</p>
            </div>
            <BuildingOfficeIcon className="h-12 w-12 text-indigo-500" />
          </div>
        </Link>

        <Link
          to="/contacts"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 uppercase">Contacts</p>
              <p className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                Global
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalContacts}</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-blue-500" />
          </div>
        </Link>

        <Link
          to="/opportunites"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 uppercase">Opportunités</p>
              <p className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Période + étapes
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalOpportunities}</p>
            </div>
            <BriefcaseIcon className="h-12 w-12 text-purple-500" />
          </div>
        </Link>

        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-100 uppercase">
                CA signé (date de gain)
                {filterPreset === 'ALL'
                  ? ' – Tout l’historique'
                  : filterPreset === 'MONTH'
                  ? ' – Mois en cours'
                  : filterPreset === 'QUARTER'
                  ? ' – Trimestre en cours'
                  : filterPreset === 'YEAR'
                  ? ' – Année en cours'
                  : filterPreset === 'LAST_12_MONTHS'
                  ? ' – 12 derniers mois'
                  : filterPreset === 'CUSTOM'
                  ? ' – Période personnalisée'
                  : ''}
              </p>
              <p className="text-3xl font-bold text-white mt-2">{stats.wonValue.toFixed(0)} €</p>
              <div className="mt-3 pt-2 border-t border-emerald-400 border-opacity-30">
                <p className="text-xs text-emerald-100">
                  CA Net (-{(stats.averageTaxRate * 100).toFixed(1)}%)
                </p>
                <p className="text-xl font-semibold text-white">{stats.netRevenue.toFixed(0)} €</p>
              </div>
              <p className="text-xs text-emerald-100 mt-2">
                Pipeline : {stats.pipelineValue.toFixed(0)} € 
                <span className="text-emerald-100"> ({(stats.pipelineValue * 0.73).toFixed(0)} €)</span>
              </p>
            </div>
            <ArrowTrendingUpIcon className="h-12 w-12 text-white" />
          </div>
        </div>
      </div>

      {/* Statistiques CA : confirmé / facturé / encaissé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500 uppercase">CA signé (par date de gain)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{signedGross.toFixed(0)} €</p>
          <p className="text-xs text-slate-500 mt-1">
            Net estimé : <span className="font-semibold text-emerald-600">{signedNet.toFixed(0)} €</span>
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500 uppercase">CA facturé (par date de facture)</p>
          {invoicedGross === 0 && invoicedNet === 0 ? (
            <div className="mt-2">
              <p className="text-sm font-medium text-slate-400">Données non disponibles</p>
              <p className="text-xs text-slate-400 mt-1">
                Factures gérées dans Tiime – intégration à venir.
              </p>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900 mt-2">{invoicedGross.toFixed(0)} €</p>
              <p className="text-xs text-slate-500 mt-1">
                Net estimé : <span className="font-semibold text-emerald-600">{invoicedNet.toFixed(0)} €</span>
              </p>
            </>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500 uppercase">CA encaissé (par date de paiement)</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{paidGross.toFixed(0)} €</p>
          <p className="text-xs text-slate-500 mt-1">
            Net estimé : <span className="font-semibold text-emerald-600">{paidNet.toFixed(0)} €</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tunnel de conversion */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Tunnel de conversion</h2>
          </div>
          
          <div className="space-y-3">
            {Object.entries(STAGES).map(([stage, { label, color }]) => {
              const count = stats.opportunitiesByStage[stage] || 0;
              const percentage =
                stats.totalOpportunities > 0 ? (count / stats.totalOpportunities) * 100 : 0;
              
              const stageOpps =
                stats.filteredOpportunities?.filter((o: any) => o.stage === stage) || [];
              const stageValue = stageOpps.reduce(
                (sum: number, opp: any) => sum + (Number(opp.amount) || 0),
                0
              );
              const pipelineShare =
                stats.pipelineValue > 0 ? (stageValue / stats.pipelineValue) * 100 : 0;

              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="text-slate-500">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} transition-all duration-500`}
                      style={{ width: `${percentage.toFixed(1)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Valeur : {stageValue.toFixed(0)} €</span>
                    {stats.pipelineValue > 0 && (
                      <span>{pipelineShare.toFixed(1)}% du pipeline</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Taux de conversion</span>
              <span className="text-2xl font-bold text-emerald-600">{conversionRate}%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.opportunitiesByStage['CLOSED_WON'] || 0} opportunités gagnées sur {stats.totalOpportunities}
            </p>
          </div>
        </div>

        {/* Opportunités récentes */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">📋 Dernières opportunités</h2>
          
          {stats.recentOpportunities.length > 0 ? (
            <div className="space-y-3">
              {stats.recentOpportunities.map((opp: any) => (
                <Link
                  key={opp.id}
                  to={`/opportunities/${opp.id}`}
                  className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-sm">{opp.title}</p>
                      {opp.company && (
                        <p className="text-xs text-slate-500 mt-1">🏢 {opp.company.name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                        STAGES[opp.stage as keyof typeof STAGES]?.color 
                          ? `${STAGES[opp.stage as keyof typeof STAGES].color} bg-opacity-20 text-slate-700`
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {STAGES[opp.stage as keyof typeof STAGES]?.label || opp.stage}
                      </span>
                      {opp.amount && (
                        <p className="text-sm font-semibold text-indigo-600 mt-1">
                          {Number(opp.amount).toFixed(0)} €
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p>Aucune opportunité pour le moment</p>
              <button
                onClick={() => navigate('/opportunites')}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-500"
              >
                Créer votre première opportunité →
              </button>
            </div>
          )}

          <Link
            to="/opportunities"
            className="block mt-4 pt-4 border-t border-slate-200 text-center text-sm text-indigo-600 hover:text-indigo-500"
          >
            Voir toutes les opportunités →
          </Link>
        </div>
      </div>

      <ProjectionView opportunities={stats.stageFilteredOpportunities as any} />

      <PipelineByStageView
        opportunities={stats.stageFilteredOpportunities as any}
        visibleStages={filterStages}
      />
    </div>
  );
}

