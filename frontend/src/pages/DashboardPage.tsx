import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  UserGroupIcon, 
  BuildingOfficeIcon, 
  BriefcaseIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, PieChart, Pie, Cell } from 'recharts';
import api from '../services/apiClient';

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-500' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-500' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-500' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-500' }
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalCompanies: 0,
    totalOpportunities: 0,
    pipelineValue: 0,
    wonValue: 0,
    netRevenue: 0,
    opportunitiesByStage: {} as Record<string, number>,
    recentOpportunities: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [selectedStages, setSelectedStages] = useState<string[]>(['QUALIFICATION', 'PROPOSAL', 'CLOSED_WON']);
  const [chartType, setChartType] = useState<'projected' | 'won'>('projected');

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [contactsRes, companiesRes, opportunitiesRes] = await Promise.all([
        api.get('/api/contacts', { params: { limit: 1000 } }),
        api.get('/api/companies'),
        api.get('/api/opportunities', { params: { limit: 1000 } })
      ]);

      const contacts = contactsRes.data.data || [];
      const companies = Array.isArray(companiesRes.data) ? companiesRes.data : (companiesRes.data.data || []);
      const opportunities = opportunitiesRes.data.data || [];

      const oppsByStage = opportunities.reduce((acc: any, opp: any) => {
        acc[opp.stage] = (acc[opp.stage] || 0) + 1;
        return acc;
      }, {});

      const pipelineValue = opportunities
        .filter((o: any) => o.stage !== 'CLOSED_LOST')
        .reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0);

      const wonValue = opportunities
        .filter((o: any) => o.stage === 'CLOSED_WON')
        .reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0);
      
      const netRevenue = wonValue * 0.73; // CA net = CA réalisé - 27%

      setStats({
        totalContacts: contacts.length,
        totalCompanies: companies.length,
        totalOpportunities: opportunities.length,
        pipelineValue,
        wonValue,
        netRevenue,
        opportunitiesByStage: oppsByStage,
        recentOpportunities: opportunities.slice(0, 5)
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
    setLoading(false);
  };

  const conversionRate = stats.totalOpportunities > 0 
    ? ((stats.opportunitiesByStage['CLOSED_WON'] || 0) / stats.totalOpportunities * 100).toFixed(1)
    : 0;

  // Calculer l'évolution du CA par mois et par client pour Recharts
  const getRechartsData = () => {
    const monthlyData: Record<string, Record<string, { projected: number; won: number }>> = {};
    
    // Filtrer les opportunités selon les étapes sélectionnées
    const filteredOpportunities = stats.recentOpportunities.filter((opp: any) => 
      selectedStages.includes(opp.stage)
    );
    
    filteredOpportunities.forEach((opp: any) => {
      const date = opp.closeDate ? new Date(opp.closeDate) : new Date();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const companyName = opp.company?.name || 'Sans entreprise';
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {};
      }
      
      if (!monthlyData[monthKey][companyName]) {
        monthlyData[monthKey][companyName] = { projected: 0, won: 0 };
      }
      
      const amount = Number(opp.amount) || 0;
      if (opp.stage === 'CLOSED_WON') {
        monthlyData[monthKey][companyName].won += amount;
      }
      if (opp.stage !== 'CLOSED_LOST') {
        monthlyData[monthKey][companyName].projected += amount;
      }
    });

    // Trier par date et prendre les 6 derniers mois disponibles
    const sorted = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b));

    const monthsToShow = sorted.slice(-6);

    // Créer la structure pour Recharts (format aplati)
    const result = monthsToShow.map(([month, companies]) => {
      const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const data: any = { month: monthLabel };
      
      Object.entries(companies).forEach(([companyName, amounts]) => {
        if (amounts[chartType] > 0) {
          data[companyName] = amounts[chartType];
        }
      });
      
      return data;
    });

    return result;
  };

  const chartData = getRechartsData();
  
  // Couleurs pour les entreprises (format Recharts)
  const companyColors = [
    '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', 
    '#EF4444', '#6366F1', '#EC4899', '#14B8A6'
  ];
  
  const getCompanyColor = (index: number) => companyColors[index % companyColors.length];
  
  // Obtenir toutes les entreprises uniques pour les barres
  const allCompanies = Array.from(new Set(
    chartData.flatMap(data => Object.keys(data).filter(key => key !== 'month'))
  ));

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Chargement du tableau de bord...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-slate-500 mt-1">Vue d'ensemble de votre activité commerciale</p>
      </div>

      {/* Statistiques principales - Cliquables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/companies"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 uppercase">Clients</p>
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
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalContacts}</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-blue-500" />
          </div>
        </Link>

        <Link
          to="/opportunities"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 uppercase">Opportunités</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalOpportunities}</p>
            </div>
            <BriefcaseIcon className="h-12 w-12 text-purple-500" />
          </div>
        </Link>

        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-100 uppercase">CA Réalisé</p>
              <p className="text-3xl font-bold text-white mt-2">{stats.wonValue.toFixed(0)} €</p>
              <div className="mt-3 pt-2 border-t border-emerald-400 border-opacity-30">
                <p className="text-xs text-emerald-100">CA Net (-27%)</p>
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

      {/* Ajouts rapides */}
      <div className="rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">⚡ Créer rapidement</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/companies/new')}
            className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <PlusIcon className="h-6 w-6 text-indigo-600" />
            <div className="text-left">
              <p className="font-semibold text-slate-900">Nouveau client</p>
              <p className="text-xs text-slate-500">Entreprise</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/contacts/new')}
            className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <PlusIcon className="h-6 w-6 text-blue-600" />
            <div className="text-left">
              <p className="font-semibold text-slate-900">Nouveau contact</p>
              <p className="text-xs text-slate-500">Personne</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/opportunities')}
            className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <PlusIcon className="h-6 w-6 text-purple-600" />
            <div className="text-left">
              <p className="font-semibold text-slate-900">Nouvelle opportunité</p>
              <p className="text-xs text-slate-500">Affaire</p>
            </div>
          </button>
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
              const percentage = stats.totalOpportunities > 0 
                ? (count / stats.totalOpportunities * 100).toFixed(1)
                : 0;
              
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="text-slate-500">{count} ({percentage}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${color} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
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
                onClick={() => navigate('/opportunities')}
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

      {/* Évolution CA dans le temps - Graphique empilé par clients avec Recharts */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">📈 Évolution du CA par client</h2>
          
          {/* Contrôles du graphique */}
          <div className="flex items-center gap-4">
            {/* Type de graphique */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Type:</label>
              <select 
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'projected' | 'won')}
                className="text-sm border border-slate-300 rounded px-2 py-1"
              >
                <option value="projected">CA Prévu</option>
                <option value="won">CA Réalisé</option>
              </select>
            </div>
            
            {/* Filtre par étapes */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-slate-500" />
              <select 
                multiple
                value={selectedStages}
                onChange={(e) => {
                  const options = Array.from(e.target.selectedOptions, option => option.value);
                  setSelectedStages(options);
                }}
                className="text-sm border border-slate-300 rounded px-2 py-1 min-w-32"
                size={1}
              >
                {Object.entries(STAGES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {chartData.length > 0 && allCompanies.length > 0 ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(0)} €`, 
                    name
                  ]}
                  labelFormatter={(label) => `Mois: ${label}`}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white'
                  }}
                />
                <Legend />
                
                {/* Barres empilées pour chaque entreprise */}
                {allCompanies.map((company, index) => (
                  <Bar
                    key={company}
                    dataKey={company}
                    stackId="a"
                    fill={getCompanyColor(index)}
                    name={company}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <p>Aucune donnée disponible pour les étapes sélectionnées</p>
            <p className="text-sm mt-2">Modifiez les filtres ou ajoutez des opportunités</p>
          </div>
        )}
      </div>

      {/* Graphique pipeline value par étape */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">💰 Valeur du pipeline par étape</h2>
        
        <div className="space-y-4">
          {Object.entries(STAGES).filter(([stage]) => stage !== 'CLOSED_LOST').map(([stage, { label, color }]) => {
            const stageOpps = stats.recentOpportunities?.filter((o: any) => o.stage === stage) || [];
            const stageValue = stageOpps.reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0);
            const maxValue = stats.pipelineValue || 1;
            const percentage = (stageValue / maxValue * 100).toFixed(1);
            
            return (
              <div key={stage}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700">{label}</span>
                  <span className="font-bold text-slate-900">{stageValue.toFixed(0)} €</span>
                </div>
                <div className="h-8 bg-slate-100 rounded-lg overflow-hidden">
                  <div 
                    className={`h-full ${color} flex items-center justify-end pr-3 transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  >
                    {parseFloat(percentage) > 15 && (
                      <span className="text-xs font-semibold text-white">{percentage}%</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 bg-slate-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Total Pipeline</span>
            <span className="text-2xl font-bold text-indigo-600">{stats.pipelineValue.toFixed(0)} €</span>
          </div>
        </div>
      </div>
    </div>
  );
}

