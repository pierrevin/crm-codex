import { useEffect, useState } from 'react';

import api from '../services/apiClient';

type Opportunity = {
  id: string;
  title: string;
  stage: string;
  amount?: number;
  contact?: { firstName: string; lastName?: string } | null;
  company?: { name: string } | null;
};

type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
};

export function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    void loadOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const loadOpportunities = async () => {
    const { data } = await api.get<PaginatedResponse<Opportunity>>('/api/opportunities', {
      params: { cursor }
    });
    if (cursor) {
      setOpportunities((prev) => [...prev, ...data.data]);
    } else {
      setOpportunities(data.data);
    }
    setNextCursor(data.nextCursor);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Opportunities</h1>
        <p className="text-sm text-slate-500">Track deals and monitor their progress.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opportunities.map((opportunity) => (
              <tr key={opportunity.id} className="text-sm text-slate-700">
                <td className="px-4 py-3 font-medium text-slate-900">{opportunity.title}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                    {opportunity.stage.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">{opportunity.amount !== undefined && opportunity.amount !== null ? `€${Number(opportunity.amount).toFixed(2)}` : '-'}</td>
                <td className="px-4 py-3">
                  {opportunity.contact
                    ? `${opportunity.contact.firstName} ${opportunity.contact.lastName ?? ''}`
                    : opportunity.company?.name ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nextCursor && (
          <div className="bg-white px-4 py-3 text-center">
            <button
              onClick={() => setCursor(nextCursor)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
