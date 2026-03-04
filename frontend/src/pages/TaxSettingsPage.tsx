import { useEffect, useState } from 'react';

import { taxService, TaxRateConfig } from '../services/taxService';

export function TaxSettingsPage() {
  const [configs, setConfigs] = useState<TaxRateConfig[]>([]);
  const [ratePercent, setRatePercent] = useState<string>('28');
  const [label, setLabel] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await taxService.getAll();
      setConfigs(data);
    } catch (err: any) {
      console.error('Erreur chargement taux de taxe:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des taux de taxe');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const rate = parseFloat(ratePercent) / 100;
      await taxService.create({
        rate,
        label: label || undefined,
        effectiveFrom: `${effectiveFrom}T00:00:00.000Z`
      });
      setLabel('');
      await load();
    } catch (err: any) {
      console.error('Erreur création taux de taxe:', err);
      setError(err.response?.data?.message || 'Erreur lors de la création du taux de taxe');
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(2)} %`;

  const today = new Date();
  const currentConfig = configs.find((c) => new Date(c.effectiveFrom) <= today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres des taxes</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gérez ici l&apos;historique des taux de taxe appliqués aux opportunités, factures et paiements.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {currentConfig && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">
            Taux en vigueur aujourd&apos;hui :{' '}
            <span className="font-semibold">{formatPercent(currentConfig.rate)}</span>{' '}
            (depuis le {new Date(currentConfig.effectiveFrom).toLocaleDateString('fr-FR')})
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Historique des taux</h2>
          {configs.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun taux de taxe configuré pour le moment.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Date d&apos;effet</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Taux</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Libellé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configs.map((config) => (
                  <tr key={config.id}>
                    <td className="px-3 py-2 text-slate-700">
                      {new Date(config.effectiveFrom).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatPercent(config.rate)}</td>
                    <td className="px-3 py-2 text-slate-500">{config.label || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Ajouter un taux</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Taux de taxe (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date d&apos;effet
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Libellé (optionnel)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Ajouter le taux'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

