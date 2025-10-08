import { useEffect, useState } from 'react';

import api from '../services/apiClient';

type Activity = {
  id: string;
  type: string;
  subject: string;
  dueDate?: string;
};

type GmailMessage = {
  id: string;
  subject?: string;
  from?: string;
  snippet?: string | null;
};

type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
};

const typeLabels: Record<string, string> = {
  CALL: 'Appel',
  EMAIL: 'Email',
  MEETING: 'Réunion',
  TASK: 'Tâche',
  EVENT: 'Événement'
};

export function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loadingGmail, setLoadingGmail] = useState(false);

  useEffect(() => {
    void loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const loadActivities = async () => {
    const { data } = await api.get<PaginatedResponse<Activity>>('/api/activities', {
      params: { cursor }
    });
    if (cursor) {
      setActivities((prev) => [...prev, ...data.data]);
    } else {
      setActivities(data.data);
    }
    setNextCursor(data.nextCursor);
  };

  const syncCalendar = async () => {
    try {
      setSyncing(true);
      await api.post('/api/google/sync-calendar');
      setCursor(undefined);
      await loadActivities();
    } finally {
      setSyncing(false);
    }
  };

  const loadGmail = async () => {
    try {
      setLoadingGmail(true);
      const { data } = await api.get<GmailMessage[]>('/api/google/gmail/messages');
      setGmailMessages(data);
    } finally {
      setLoadingGmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Activités</h1>
          <p className="text-sm text-slate-500">Restez au courant de vos tâches et interactions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncCalendar}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            disabled={syncing}
          >
            {syncing ? 'Synchronisation…' : 'Sync Google Calendar'}
          </button>
          <button
            onClick={loadGmail}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100"
            disabled={loadingGmail}
          >
            {loadingGmail ? 'Chargement…' : 'Charger Gmail'}
          </button>
          <button
            onClick={() => setCursor(undefined)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100"
          >
            Actualiser
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                {typeLabels[activity.type] ?? activity.type}
              </span>
              <span className="text-xs text-slate-400">
                {activity.dueDate ? new Date(activity.dueDate).toLocaleString('fr-FR') : 'Pas d\'échéance'}
              </span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900">{activity.subject}</h3>
          </div>
        ))}
      </div>
      {nextCursor && (
        <div className="text-center">
          <button
            onClick={() => setCursor(nextCursor)}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100"
          >
            Charger plus
          </button>
        </div>
      )}
      {gmailMessages.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Derniers emails (Gmail)</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {gmailMessages.map((message) => (
              <li key={message.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <div className="font-medium text-slate-900">{message.subject ?? 'Sans objet'}</div>
                <div className="text-xs text-slate-500">{message.from ?? 'Expéditeur inconnu'}</div>
                <p className="mt-1 text-xs text-slate-500">{message.snippet}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
