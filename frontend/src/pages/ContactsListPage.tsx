import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../services/apiClient';

type Contact = {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
};

export function ContactsListPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, search]);

  const loadContacts = async () => {
    const { data } = await api.get<PaginatedResponse<Contact>>('/api/contacts', {
      params: {
        cursor,
        search: search || undefined
      }
    });
    if (cursor) {
      setContacts((prev) => [...prev, ...data.data]);
    } else {
      setContacts(data.data);
    }
    setNextCursor(data.nextCursor);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">Manage your relationships with a quick overview.</p>
        </div>
        <Link
          to="/contacts/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500"
        >
          New contact
        </Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => {
              setCursor(undefined);
              setSearch(event.target.value);
            }}
            placeholder="Search contacts"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => {
              setCursor(undefined);
              void loadContacts();
            }}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            Search
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {contacts.map((contact) => (
            <Link
              key={contact.id}
              to={`/contacts/${contact.id}`}
              className="flex items-center justify-between py-3 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {contact.firstName} {contact.lastName}
                </p>
                <p className="text-xs text-slate-500">{contact.email ?? 'No email'}</p>
              </div>
              <span className="text-xs text-slate-400">View</span>
            </Link>
          ))}
        </div>
        {nextCursor && (
          <div className="mt-4 text-center">
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
