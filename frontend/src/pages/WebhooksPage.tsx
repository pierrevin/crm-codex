import { useEffect, useState } from 'react';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import api from '../services/apiClient';

type Webhook = {
  id: string;
  url: string;
  event: string;
  createdAt: string;
};

type WebhookEvent = {
  name: string;
  description: string;
  payload: any;
};

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvent, setNewWebhookEvent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadWebhooks();
    void loadEvents();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/webhooks');
      setWebhooks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erreur chargement webhooks:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des webhooks');
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/api/webhooks/events');
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur chargement événements:', err);
    }
  };

  const handleAdd = async () => {
    if (!newWebhookUrl || !newWebhookEvent) {
      setError('URL et événement sont requis');
      return;
    }

    try {
      setError(null);
      await api.post('/api/webhooks', {
        url: newWebhookUrl,
        event: newWebhookEvent
      });
      
      // Réinitialiser le formulaire
      setNewWebhookUrl('');
      setNewWebhookEvent('');
      setShowAddForm(false);
      
      // Recharger la liste
      await loadWebhooks();
    } catch (err: any) {
      console.error('Erreur ajout webhook:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'ajout du webhook');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce webhook ?')) {
      return;
    }

    try {
      await api.delete(`/api/webhooks/${id}`);
      await loadWebhooks();
    } catch (err: any) {
      console.error('Erreur suppression webhook:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression du webhook');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Webhooks Make</h1>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
              <PlusIcon className="w-5 h-5" />
              Ajouter un webhook
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {showAddForm && (
            <div className="mb-6 p-4 bg-slate-50 rounded-md border border-slate-200">
              <h2 className="text-lg font-semibold mb-4">Nouveau webhook</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL du webhook Make
                  </label>
                  <input
                    type="url"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder="https://hook.eu1.make.com/..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Événement
                  </label>
                  <select
                    value={newWebhookEvent}
                    onChange={(e) => setNewWebhookEvent(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sélectionner un événement</option>
                    {events.map((event) => (
                      <option key={event.name} value={event.name}>
                        {event.name} - {event.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewWebhookUrl('');
                      setNewWebhookEvent('');
                      setError(null);
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-slate-500">Chargement...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Aucun webhook enregistré. Cliquez sur "Ajouter un webhook" pour commencer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Événement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date de création
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {webhooks.map((webhook) => (
                    <tr key={webhook.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {webhook.url}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {webhook.event}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {formatDate(webhook.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(webhook.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Événements disponibles</h2>
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.name} className="p-3 bg-slate-50 rounded-md">
                <div className="font-medium text-slate-900">{event.name}</div>
                <div className="text-sm text-slate-600">{event.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

