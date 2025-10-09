import { FormEvent, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

export function AuthGate() {
  const { tokens, login, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('admin@crm-codex.local');
  const [password, setPassword] = useState('AdminCRM2024!');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError('Impossible de se connecter, vérifiez les identifiants.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!tokens) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-lg"
        >
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Connexion CRM Codex</h1>
            <p className="text-sm text-slate-500 mt-1">
              {location.pathname !== '/' && (
                <>Vous devez vous connecter pour accéder à cette page.</>
              )}
              {location.pathname === '/' && (
                <>Connectez-vous avec votre compte administrateur.</>
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 p-3">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
            )}
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    );
  }

  return <Outlet />;
}
