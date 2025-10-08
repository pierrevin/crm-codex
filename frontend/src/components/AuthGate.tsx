import { FormEvent, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

export function AuthGate() {
  const { tokens, login, loading } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login(email, password);
      setError(null);
    } catch (err) {
      setError('Impossible de se connecter, vérifiez les identifiants.');
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Chargement...</div>;
  }

  if (!tokens) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow"
        >
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Connexion</h1>
            <p className="text-sm text-slate-500">Connectez-vous avec votre compte administrateur.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Se connecter
          </button>
        </form>
      </div>
    );
  }

  return <Outlet />;
}
