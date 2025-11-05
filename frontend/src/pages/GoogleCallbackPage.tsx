import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/apiClient';

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extraire code et state des query parameters (Google redirige vers cette page)
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Si Google renvoie une erreur
        if (errorParam) {
          setError(`Erreur Google: ${errorDescription || errorParam}`);
          setProcessing(false);
          setTimeout(() => {
            navigate('/dashboard?google=error&message=' + encodeURIComponent(errorDescription || errorParam), { replace: true });
          }, 2000);
          return;
        }

        // Vérifier que le code est présent
        if (!code) {
          setError('Code d\'autorisation manquant');
          setProcessing(false);
          setTimeout(() => {
            navigate('/dashboard?google=error&message=Code manquant', { replace: true });
          }, 2000);
          return;
        }

        // Vérifier que le state (userId) est présent
        if (!state) {
          setError('Identifiant utilisateur manquant');
          setProcessing(false);
          setTimeout(() => {
            navigate('/dashboard?google=error&message=Identifiant manquant', { replace: true });
          }, 2000);
          return;
        }

        // Appeler l'Edge Function avec POST et les headers requis
        const response = await api.post('/api/google/callback', { code, state });
        
        if (response.data.success) {
          // Succès - rediriger vers le dashboard
          navigate('/dashboard?google=connected', { replace: true });
        } else {
          // Erreur retournée par l'Edge Function
          setError(response.data.message || 'Erreur lors de la connexion');
          setProcessing(false);
          setTimeout(() => {
            navigate(`/dashboard?google=error&message=${encodeURIComponent(response.data.message || 'Erreur inconnue')}`, { replace: true });
          }, 2000);
        }
      } catch (err: any) {
        console.error('Erreur lors du traitement du callback Google:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Erreur inconnue';
        setError(errorMessage);
        setProcessing(false);
        setTimeout(() => {
          navigate(`/dashboard?google=error&message=${encodeURIComponent(errorMessage)}`, { replace: true });
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
            <div className="mb-4 text-lg font-semibold text-slate-900">Finalisation de la connexion Google...</div>
            <div className="text-sm text-slate-600">Traitement en cours</div>
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

