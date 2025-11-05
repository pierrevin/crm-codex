import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const google = searchParams.get('google');
  const message = searchParams.get('message');

  useEffect(() => {
    // L'Edge Function a déjà traité le callback et redirige vers cette page
    // On redirige simplement vers le dashboard avec les paramètres
    if (google === 'connected') {
      navigate('/dashboard?google=connected', { replace: true });
    } else if (google === 'error') {
      navigate(`/dashboard?google=error&message=${message || ''}`, { replace: true });
    } else {
      // Paramètres invalides, rediriger vers le dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [google, message, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mb-4 text-lg font-semibold text-slate-900">Finalisation de la connexion Google...</div>
        <div className="text-sm text-slate-600">Redirection en cours</div>
      </div>
    </div>
  );
}

