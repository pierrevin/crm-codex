import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import api from '../services/apiClient';

type ContactPayload = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type ContactResponse = ContactPayload & { id: string };

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  const [contact, setContact] = useState<ContactPayload>({ firstName: '' });
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && id) {
      void loadContact(id);
    }
  }, [id, isNew]);

  const loadContact = async (contactId: string) => {
    setLoading(true);
    const { data } = await api.get<ContactResponse>(`/api/contacts/${contactId}`);
    setContact({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone
    });
    setLoading(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isNew) {
      await api.post('/api/contacts', contact);
    } else if (id) {
      await api.patch(`/api/contacts/${id}`, contact);
    }
    navigate('/contacts');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        {isNew ? 'Create contact' : 'Edit contact'}
      </h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">First name</label>
          <input
            value={contact.firstName}
            onChange={(event) => setContact({ ...contact, firstName: event.target.value })}
            required
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Last name</label>
          <input
            value={contact.lastName ?? ''}
            onChange={(event) => setContact({ ...contact, lastName: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={contact.email ?? ''}
            onChange={(event) => setContact({ ...contact, email: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Phone</label>
          <input
            value={contact.phone ?? ''}
            onChange={(event) => setContact({ ...contact, phone: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
