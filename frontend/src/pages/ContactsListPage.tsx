import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BuildingOfficeIcon, EnvelopeIcon, PhoneIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import api from '../services/apiClient';

type Contact = {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: { id: string; name: string } | null;
};

type PaginatedResponse<T> = {
  data?: T[];
  items?: T[];
  nextCursor?: string | null;
  total?: number;
};

export function ContactsListPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, search]);

  const loadContacts = async () => {
    const { data } = await api.get<PaginatedResponse<Contact>>('/api/contacts', {
      params: {
        cursor,
        search: search || undefined,
        limit: 1000
      }
    });
    if (cursor) {
      setContacts((prev) => [...prev, ...(data.items || data.data || [])]);
    } else {
      setContacts(data.items || data.data || []);
    }
    setTotal(data.total ?? contacts.length);
    setNextCursor(data.nextCursor ?? null);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total > 0 && `${total} contact${total > 1 ? 's' : ''} au total`}
          </p>
        </div>
        <Link
          to="/contacts/new"
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Nouveau contact</span>
        </Link>
      </div>

      {/* Recherche */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setCursor(undefined);
            setSearch(event.target.value);
          }}
          placeholder="Rechercher par nom, email ou entreprise..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
        {search && (
          <button
            onClick={() => {
              setCursor(undefined);
              setSearch('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Liste des contacts - Design Cards */}
      {contacts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <Link
              key={contact.id}
              to={`/contacts/${contact.id}`}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">
                    {contact.firstName} {contact.lastName || ''}
                  </h3>
                  {contact.company && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <BuildingOfficeIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600 truncate">{contact.company.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <EnvelopeIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <PhoneIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {!contact.email && !contact.phone && (
                  <p className="text-xs text-slate-400 italic">Aucune information de contact</p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs font-medium text-indigo-600 group-hover:text-indigo-700">
                  Voir les détails →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">Aucun contact trouvé</p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-sm text-indigo-600 hover:text-indigo-700 mt-2 font-medium"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {nextCursor && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setCursor(nextCursor)}
            className="rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Charger plus
          </button>
        </div>
      )}
    </div>
  );
}
