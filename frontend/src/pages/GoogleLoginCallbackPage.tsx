import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';

export function GoogleLoginCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extraire code et state des query parameters (Google redirige vers cette page)
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Si Google renvoie une erreur
        if (errorParam) {
          setError(`Erreur Google: ${errorDescription || errorParam}`);
          setProcessing(false);
          setTimeout(() => {
            navigate('/?error=' + encodeURIComponent(errorDescription || errorParam), { replace: true });
          }, 2000);
          return;
        }

        // Vérifier que le code est présent
        if (!code) {
          setError('Code d\'autorisation manquant');
          setProcessing(false);
          setTimeout(() => {
            navigate('/?error=Code manquant', { replace: true });
          }, 2000);
          return;
        }

        // Appeler l'endpoint d'authentification Google
        console.log('Appel /api/auth/google avec code:', code?.substring(0, 20) + '...')
        const response = await api.post('/api/auth/google', { code });
        console.log('Réponse /api/auth/google:', { 
          hasAccessToken: !!response.data.accessToken, 
          hasRefreshToken: !!response.data.refreshToken,
          message: response.data.message 
        })
        
        if (response.data.accessToken && response.data.refreshToken) {
          // Stocker les tokens dans localStorage
          localStorage.setItem('accessToken', response.data.accessToken);
          localStorage.setItem('refreshToken', response.data.refreshToken);
          console.log('Tokens stockés dans localStorage, redirection vers /dashboard')
          
          // Nettoyer l'URL pour retirer les query params
          window.history.replaceState({}, '', '/dashboard');
          
          // Forcer le rechargement complet pour que AuthGate détecte les nouveaux tokens
          window.location.href = '/dashboard';
          return;
        } else {
          // Erreur retournée par l'Edge Function
          setError(response.data.message || 'Erreur lors de la connexion');
          setProcessing(false);
          setTimeout(() => {
            navigate(`/?error=${encodeURIComponent(response.data.message || 'Erreur inconnue')}`, { replace: true });
          }, 2000);
        }
      } catch (err: any) {
        console.error('Erreur lors du traitement du callback Google login:', err);
        console.error('Détails erreur:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          message: err.message
        });
        const errorMessage = err.response?.data?.message || err.message || 'Erreur inconnue';
        setError(errorMessage);
        setProcessing(false);
        setTimeout(() => {
          navigate(`/?error=${encodeURIComponent(errorMessage)}`, { replace: true });
        }, 2000);
      }
    };

    void processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        {processing ? (
          <>
            <div className="mb-4 text-lg font-semibold text-slate-900">Connexion en cours...</div>
            <div className="text-sm text-slate-600">Traitement de votre authentification Google</div>
          </>
        ) : (
          <>
            <div className="mb-4 text-lg font-semibold text-red-600">Erreur</div>
            <div className="text-sm text-slate-600">{error || 'Une erreur est survenue'}</div>
            <div className="mt-2 text-xs text-slate-500">Redirection en cours...</div>
          </>
        )}
      </div>
    </div>
  );
}

