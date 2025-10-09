import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';

type Opportunity = {
  id: string;
  title: string;
  stage: 'QUALIFICATION' | 'PROPOSAL' | 'CLOSED_WON' | 'CLOSED_LOST';
  amount?: number;
  closeDate?: string;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-100 text-blue-700' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-100 text-purple-700' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-100 text-green-700' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-100 text-rose-700' }
};

export function ProjectionView({ 
  opportunities, 
  period,
  onPeriodChange,
  selectedStages,
  onStagesChange
}: { 
  opportunities: Opportunity[]; 
  period: 3 | 6 | 12;
  onPeriodChange: (period: 3 | 6 | 12) => void;
  selectedStages: Set<string>;
  onStagesChange: (stages: Set<string>) => void;
}) {
  // Calculer les données de projection CA par mois
  const getProjectionData = () => {
    const monthlyData: Record<string, {
      caPrev: number;
      caNet: number;
      wonCount: number;
      pipelineCount: number;
    }> = {};
    
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - period + 1, 1);
    
    // Filtrer les opportunités selon les étapes sélectionnées et avec une date de clôture
    const relevantOpps = opportunities.filter(opp => 
      selectedStages.has(opp.stage) && 
      opp.closeDate &&
      new Date(opp.closeDate) >= startDate
    );
    
    relevantOpps.forEach(opp => {
      if (!opp.closeDate) return;
      
      const date = new Date(opp.closeDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { caPrev: 0, caNet: 0, wonCount: 0, pipelineCount: 0 };
      }
      
      const amount = Number(opp.amount) || 0;
      
      if (opp.stage === 'CLOSED_WON') {
        monthlyData[monthKey].wonCount++;
        monthlyData[monthKey].caPrev += amount;
        monthlyData[monthKey].caNet += amount * 0.73; // -27%
      } else {
        // Opportunités en cours (pipeline)
        monthlyData[monthKey].pipelineCount++;
        monthlyData[monthKey].caPrev += amount;
        monthlyData[monthKey].caNet += amount * 0.73;
      }
    });
    
    // Convertir en tableau et trier par date
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        // Récupérer les détails des opportunités pour ce mois
        const monthOpps = relevantOpps.filter(opp => {
          if (!opp.closeDate) return false;
          const date = new Date(opp.closeDate);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          return monthKey === month;
        });
        
        return {
          month: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
          monthKey: month,
          caPrev: Math.round(data.caPrev),
          caNet: Math.round(data.caNet),
          wonCount: data.wonCount,
          pipelineCount: data.pipelineCount,
          totalCount: data.wonCount + data.pipelineCount,
          opportunities: monthOpps
        };
      });
  };
  
  const projectionData = getProjectionData();
  
  // Calcul des totaux
  const totals = projectionData.reduce((acc, month) => ({
    caPrev: acc.caPrev + month.caPrev,
    caNet: acc.caNet + month.caNet,
    wonCount: acc.wonCount + month.wonCount,
    pipelineCount: acc.pipelineCount + month.pipelineCount,
    totalCount: acc.totalCount + month.totalCount
  }), { caPrev: 0, caNet: 0, wonCount: 0, pipelineCount: 0, totalCount: 0 });
  
  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-900">📊 Projection CA sur {period} mois</h2>
          <select
            value={period}
            onChange={(e) => onPeriodChange(Number(e.target.value) as 3 | 6 | 12)}
            className="text-sm border border-slate-300 rounded-md px-3 py-1.5"
          >
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
          </select>
          
          {/* Filtres par étapes */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Étapes :</span>
            {Object.entries(STAGES).map(([stage, { label, color }]) => (
              <label key={stage} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={selectedStages.has(stage)}
                  onChange={(e) => {
                    const newStages = new Set(selectedStages);
                    if (e.target.checked) {
                      newStages.add(stage);
                    } else {
                      newStages.delete(stage);
                    }
                    onStagesChange(newStages);
                  }}
                  className="rounded border-slate-300"
                />
                <span className={color}>{label}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Indicateurs clés */}
        <div className="flex gap-6 text-sm">
          <div className="text-right">
            <p className="text-slate-500">CA Prévu Total</p>
            <p className="text-xl font-bold text-indigo-600">{totals.caPrev.toLocaleString()} €</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">CA Net Total (-27%)</p>
            <p className="text-xl font-bold text-emerald-600">{totals.caNet.toLocaleString()} €</p>
          </div>
        </div>
      </div>

      {/* Graphique de projection */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {projectionData.length > 0 ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={projectionData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    
                    return (
                      <div className="bg-slate-800 text-white p-3 rounded-lg shadow-lg border border-slate-700 max-w-xs">
                        <p className="font-semibold text-sm mb-2">{label}</p>
                        <div className="space-y-1 text-xs">
                          <p><span className="text-indigo-300">CA Prévu :</span> {data.caPrev.toLocaleString()} €</p>
                          <p><span className="text-emerald-300">CA Net (-27%) :</span> {data.caNet.toLocaleString()} €</p>
                          {data.opportunities && data.opportunities.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-600">
                              <p className="text-slate-300 mb-1">Clients :</p>
                              {data.opportunities.slice(0, 3).map((opp: Opportunity, idx: number) => (
                                <p key={idx} className="text-xs text-slate-200">
                                  • {opp.title} ({opp.amount?.toLocaleString()} €)
                                  {opp.contact && ` - ${opp.contact.firstName} ${opp.contact.lastName || ''}`}
                                  {opp.company && ` (${opp.company.name})`}
                                </p>
                              ))}
                              {data.opportunities.length > 3 && (
                                <p className="text-xs text-slate-400">+ {data.opportunities.length - 3} autres...</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend 
                  formatter={(value) => value === 'caPrev' ? 'CA Prévu' : 'CA Net (-27%)'}
                />
                <Bar dataKey="caPrev" fill="#6366f1" name="caPrev" radius={[4, 4, 0, 0]} />
                <Bar dataKey="caNet" fill="#10b981" name="caNet" radius={[4, 4, 0, 0]} />
                <Line 
                  type="monotone" 
                  dataKey="caNet" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="caNet"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            <p>Aucune donnée de projection disponible</p>
            <p className="text-sm mt-2">Ajoutez des opportunités avec des dates de clôture</p>
          </div>
        )}
      </div>

      {/* Tableau récapitulatif */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">📋 Récapitulatif mensuel</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Mois
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  CA Prévu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  CA Net (-27%)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Opportunités
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {projectionData.map((month) => (
                <tr key={month.monthKey}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {month.month}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {month.caPrev.toLocaleString()} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-semibold">
                    {month.caNet.toLocaleString()} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {month.totalCount} ({month.wonCount} gagnées)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Totaux */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-slate-900">Totaux</span>
            <div className="flex gap-8 text-sm">
              <div className="text-right">
                <p className="text-slate-500">CA Prévu</p>
                <p className="text-xl font-bold text-indigo-600">{totals.caPrev.toLocaleString()} €</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">CA Net (-27%)</p>
                <p className="text-xl font-bold text-emerald-600">{totals.caNet.toLocaleString()} €</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Opportunités</p>
                <p className="text-xl font-bold text-slate-600">{totals.totalCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Indicateurs de performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-slate-500">CA Moyen par Opportunité</p>
            <p className="text-2xl font-bold text-indigo-600">
              {totals.totalCount > 0 ? Math.round(totals.caPrev / totals.totalCount).toLocaleString() : 0} €
            </p>
          </div>
        </div>
        
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-slate-500">Taux de Conversion</p>
            <p className="text-2xl font-bold text-emerald-600">
              {totals.totalCount > 0 ? Math.round((totals.wonCount / totals.totalCount) * 100) : 0}%
            </p>
          </div>
        </div>
        
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-slate-500">Marge Nette Moyenne</p>
            <p className="text-2xl font-bold text-slate-600">73%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
