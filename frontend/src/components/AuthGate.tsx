import { FormEvent, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import api from '../services/apiClient';

export function AuthGate() {
  const { tokens, login, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('pierrevincenot@immediatlab.fr');
  const [password, setPassword] = useState('AdminCRM2024!');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

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

  const handleGoogleLogin = async () => {
    setIsConnectingGoogle(true);
    setError(null);
    try {
      // Obtenir l'URL OAuth Google pour le login (sans userId car on n'est pas encore connecté)
      const { data } = await api.get('/api/google/auth-url')
      if (data.url) {
        // Rediriger vers Google OAuth avec un paramètre spécial pour indiquer que c'est pour le login
        window.location.href = `${data.url}&login=true`
      } else {
        setError('Erreur: Impossible de générer l\'URL OAuth')
        setIsConnectingGoogle(false)
      }
    } catch (error: any) {
      console.error('Erreur connexion Google:', error)
      setError(`Erreur: ${error.response?.data?.message || error.message || 'Erreur inconnue'}`)
      setIsConnectingGoogle(false)
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
            disabled={isSubmitting || isConnectingGoogle}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
            )}
            {isSubmitting ? 'Connexion...' : 'Se connecter'}
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">ou</span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || isConnectingGoogle}
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isConnectingGoogle ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-slate-600 border-r-transparent"></div>
                Connexion...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Se connecter avec Google
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  return <Outlet />;
}
