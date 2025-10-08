import { ChangeEvent, useState } from 'react';

import api from '../services/apiClient';

export function ImportPage() {
  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvContent(text);
  };

  const handleSubmit = async () => {
    if (!csvContent) return;
    const { data } = await api.post('/api/imports/csv', {
      filename: fileName || 'import.csv',
      csv: csvContent
    });
    setStatus(`Imported ${data.imported} contacts successfully.`);
    setCsvContent('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import contacts from CSV</h1>
        <p className="text-sm text-slate-500">
          Upload a CSV file with headers <code>firstName,lastName,email,phone</code> to import contacts quickly.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
        <textarea
          value={csvContent}
          onChange={(event) => setCsvContent(event.target.value)}
          rows={10}
          placeholder="Paste CSV content here"
          className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Import
          </button>
        </div>
        {status && <p className="mt-4 text-sm text-emerald-600">{status}</p>}
      </div>
    </div>
  );
}
