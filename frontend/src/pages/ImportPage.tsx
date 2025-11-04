import { ChangeEvent, useState } from 'react';

import api from '../services/apiClient';

export function ImportPage() {
  const [fileNameClients, setFileNameClients] = useState('');
  const [fileNameContacts, setFileNameContacts] = useState('');
  const [csvClients, setCsvClients] = useState('');
  const [csvContacts, setCsvContacts] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileClients = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileNameClients(file.name);
    const text = await file.text();
    setCsvClients(text);
  };

  const handleFileContacts = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileNameContacts(file.name);
    const text = await file.text();
    setCsvContacts(text);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let data: any;
      if (csvClients && csvContacts) {
        const resp = await api.post('/api/imports/axonaut', {
          filenameClients: fileNameClients || 'Save_clients_Axonaut.csv',
          filenameContacts: fileNameContacts || 'Save_contacts_Axonaut.csv',
          clientsCsv: csvClients,
          contactsCsv: csvContacts,
          dryRun
        });
        data = resp.data;
      } else {
        // Import depuis serveur (BDD_archives)
        const resp = await api.post(`/api/imports/axonaut/files?dryRun=${dryRun ? 'true' : 'false'}`);
        data = resp.data;
      }
    const parts: string[] = [];
    if (typeof data.createdCompanies === 'number') parts.push(`${data.createdCompanies} sociétés créées`);
    if (typeof data.updatedCompanies === 'number') parts.push(`${data.updatedCompanies} sociétés mises à jour`);
    if (typeof data.createdContacts === 'number') parts.push(`${data.createdContacts} contacts créés`);
    if (typeof data.updatedContacts === 'number') parts.push(`${data.updatedContacts} contacts mis à jour`);
    if (Array.isArray(data.errors) && data.errors.length > 0) parts.push(`${data.errors.length} erreurs`);
    setStatus(`${dryRun ? 'Dry-run: ' : ''}${parts.join(' • ')}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Importer Axonaut (clients + contacts)</h1>
        <p className="text-sm text-slate-500">Chargez les deux fichiers Axonaut exportés (clients et contacts). Un dry-run calcule les créations/mises à jour sans rien écrire.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Fichier clients</label>
            <input type="file" accept=".csv" onChange={handleFileClients} className="text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fichier contacts</label>
            <input type="file" accept=".csv" onChange={handleFileContacts} className="text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            <span className="text-sm text-slate-700">Dry-run (recommandé)</span>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            disabled={loading}
          >
            {loading ? 'Veuillez patienter…' : (dryRun ? 'Lancer le dry-run' : 'Importer')}
          </button>
        </div>
        {status && <p className="mt-4 text-sm text-emerald-600">{status}</p>}
      </div>
    </div>
  );
}
