import { useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type Opportunity = {
  id: string;
  title: string;
  stage: 'QUALIFICATION' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'FINALIZED' | 'CLOSED_LOST';
  amount?: number;
  expectedPaymentDate?: string;
  contact?: { id: string; firstName: string; lastName?: string } | null;
  company?: { id: string; name: string } | null;
};

const STAGES = {
  QUALIFICATION: { label: 'Qualification', color: 'bg-blue-100 text-blue-700' },
  PROPOSAL: { label: 'Proposition', color: 'bg-purple-100 text-purple-700' },
  NEGOTIATION: { label: 'Négociation', color: 'bg-yellow-100 text-yellow-700' },
  CLOSED_WON: { label: 'Gagné', color: 'bg-green-100 text-green-700' },
  FINALIZED: { label: 'Finalisé / réglé', color: 'bg-amber-100 text-amber-700' },
  CLOSED_LOST: { label: 'Perdu', color: 'bg-rose-100 text-rose-700' }
};

type PeriodType = '3' | '6' | '12' | 'custom';

export function TreasuryView({ 
  opportunities 
}: { 
  opportunities: Opportunity[]; 
}) {
  const [periodType, setPeriodType] = useState<PeriodType>('6');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set(['CLOSED_WON', 'PROPOSAL', 'NEGOTIATION']));

  // Calculer les dates de début et fin selon le type de période
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Fin du mois actuel

    if (periodType === 'custom') {
      if (!customStartDate || !customEndDate) {
        // Par défaut, utiliser les 6 derniers mois si pas de dates personnalisées
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      } else {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
      }
    } else {
      const months = parseInt(periodType);
      startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    }

    return { startDate, endDate };
  };

  // Calculer les données de trésorerie par mois
  const getTreasuryData = () => {
    const { startDate, endDate } = getDateRange();
    const monthlyData: Record<string, {
      caHT: number;
      taxes: number;
      caNet: number;
      count: number;
      opportunities: Opportunity[];
    }> = {};
    
    // Debug: afficher les opportunités reçues
    console.log('TreasuryView - Opportunités reçues:', opportunities.length);
    console.log('TreasuryView - Opportunités avec expectedPaymentDate:', 
      opportunities.filter(opp => opp.expectedPaymentDate).length);
    
    // Filtrer les opportunités selon les étapes sélectionnées et avec une date de paiement prévisionnelle
    const relevantOpps = opportunities.filter(opp => 
      selectedStages.has(opp.stage) && 
      opp.expectedPaymentDate &&
      opp.amount &&
      opp.amount > 0
    );
    
    console.log('TreasuryView - Opportunités pertinentes après filtrage:', relevantOpps.length);
    
    relevantOpps.forEach(opp => {
      if (!opp.expectedPaymentDate || !opp.amount) return;
      
      const paymentDate = new Date(opp.expectedPaymentDate);
      
      // Vérifier que la date est dans la plage sélectionnée
      if (paymentDate < startDate || paymentDate > endDate) return;
      
      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { caHT: 0, taxes: 0, caNet: 0, count: 0, opportunities: [] };
      }
      
      const amountHT = Number(opp.amount) || 0;
      const taxes = amountHT * 0.28; // 28% de taxes (valeur par défaut actuelle)
      const amountNet = amountHT * 0.73; // Montant net après taxes
      
      monthlyData[monthKey].caHT += amountHT;
      monthlyData[monthKey].taxes += taxes;
      monthlyData[monthKey].caNet += amountNet;
      monthlyData[monthKey].count++;
      monthlyData[monthKey].opportunities.push(opp);
    });
    
    // Convertir en tableau et trier par date
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        monthKey: month,
        caHT: Math.round(data.caHT),
        taxes: Math.round(data.taxes),
        caNet: Math.round(data.caNet),
        count: data.count,
        opportunities: data.opportunities
      }));
  };
  
  const treasuryData = getTreasuryData();
  
  // Calcul des totaux
  const totals = treasuryData.reduce((acc, month) => ({
    caHT: acc.caHT + month.caHT,
    taxes: acc.taxes + month.taxes,
    caNet: acc.caNet + month.caNet,
    count: acc.count + month.count
  }), { caHT: 0, taxes: 0, caNet: 0, count: 0 });

  const { startDate, endDate } = getDateRange();
  
  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">💰 Suivi trésorerie</h2>
          
          {/* Indicateurs clés */}
          <div className="flex gap-6 text-sm">
            <div className="text-right">
              <p className="text-slate-500">CA HT Total</p>
              <p className="text-xl font-bold text-indigo-600">{totals.caHT.toLocaleString()} €</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Taxes (27%)</p>
              <p className="text-xl font-bold text-amber-600">{totals.taxes.toLocaleString()} €</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">CA Net Total</p>
              <p className="text-xl font-bold text-emerald-600">{totals.caNet.toLocaleString()} €</p>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          {/* Filtre période */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Période :</span>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5"
            >
              <option value="3">3 mois</option>
              <option value="6">6 mois</option>
              <option value="12">12 mois</option>
              <option value="custom">Personnalisée</option>
            </select>
          </div>

          {/* Dates personnalisées */}
          {periodType === 'custom' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Du :</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-sm border border-slate-300 rounded-md px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Au :</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-sm border border-slate-300 rounded-md px-2 py-1"
                />
              </div>
            </>
          )}

          {/* Filtres par étapes */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-slate-700">Statuts :</span>
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
                    setSelectedStages(newStages);
                  }}
                  className="rounded border-slate-300"
                />
                <span className={color}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Info période sélectionnée */}
        <div className="text-xs text-slate-500">
          Période : {startDate.toLocaleDateString('fr-FR')} - {endDate.toLocaleDateString('fr-FR')}
        </div>
      </div>

      {/* Graphique de trésorerie */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {treasuryData.length > 0 ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={treasuryData}
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
                          <p><span className="text-indigo-300">CA HT :</span> {data.caHT.toLocaleString()} €</p>
                          <p><span className="text-amber-300">Taxes (27%) :</span> {data.taxes.toLocaleString()} €</p>
                          <p><span className="text-emerald-300">CA Net :</span> {data.caNet.toLocaleString()} €</p>
                          <p className="text-slate-300 mt-2">{data.count} opportunité(s)</p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    if (value === 'caHT') return 'CA HT';
                    if (value === 'taxes') return 'Taxes (27%)';
                    if (value === 'caNet') return 'CA Net';
                    return value;
                  }}
                />
                <Bar dataKey="caHT" fill="#6366f1" name="caHT" radius={[4, 4, 0, 0]} />
                <Bar dataKey="taxes" fill="#f59e0b" name="taxes" radius={[4, 4, 0, 0]} />
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
            <p>Aucune donnée de trésorerie disponible</p>
            <p className="text-sm mt-2">Ajoutez des opportunités avec des dates de paiement prévisionnelles</p>
          </div>
        )}
      </div>

      {/* Tableau récapitulatif mensuel */}
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
                  CA HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Taxes (27%)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  CA Net
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Opportunités
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {treasuryData.map((month) => (
                <tr key={month.monthKey}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {month.month}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {month.caHT.toLocaleString()} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600 font-semibold">
                    {month.taxes.toLocaleString()} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-semibold">
                    {month.caNet.toLocaleString()} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {month.count}
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
                <p className="text-slate-500">CA HT</p>
                <p className="text-xl font-bold text-indigo-600">{totals.caHT.toLocaleString()} €</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Taxes (27%)</p>
                <p className="text-xl font-bold text-amber-600">{totals.taxes.toLocaleString()} €</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">CA Net</p>
                <p className="text-xl font-bold text-emerald-600">{totals.caNet.toLocaleString()} €</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Opportunités</p>
                <p className="text-xl font-bold text-slate-600">{totals.count}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

