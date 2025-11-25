import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
});

api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  // Accès correct aux variables d'environnement Vite
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  
  // Fallback hardcodé temporaire si la variable d'env n'est pas définie
  const ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lY2JydHllcWF0aWVleWJqdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTUyMDIsImV4cCI6MjA3NTQ5MTIwMn0.Z4u7oicInUcPjT19p71NRyu6ck63HSXHByH8uL5-IvY';
  const effectiveAnonKey = anonKey || ANON_KEY_FALLBACK;

    config.headers = config.headers ?? {};

  // Si l'API cible est une Edge Function Supabase
  const isSupabaseEdge = typeof api.defaults.baseURL === 'string' && api.defaults.baseURL.includes('.supabase.co/functions/v1');
  if (isSupabaseEdge) {
    // Sanitize valeurs (éviter caractères non ASCII dans headers)
    const sanitize = (s?: string) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim();
    const anon = sanitize(effectiveAnonKey);
    const at = sanitize(accessToken ?? '');
    
    // Supabase requiert TOUJOURS Authorization + apikey (même pour routes publiques)
    (config.headers as any).Authorization = `Bearer ${anon}`;
    (config.headers as any).apikey = anon;
    
    // Log pour debug si la variable d'env manque
    if (!anonKey) {
      console.warn('VITE_SUPABASE_ANON_KEY non définie, utilisation du fallback. Vérifiez la configuration Vercel.');
    }
    
    // JWT utilisateur dans un header custom (seulement si présent)
    if (at) {
      (config.headers as any)['x-user-authorization'] = `Bearer ${at}`;
  }
  } else if (accessToken) {
    // Cas backend custom classique
    (config.headers as any).Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          // Utiliser l'instance API pour bénéficier des bons en-têtes (apikey/Authorization ANON)
          const { data } = await api.post(`/api/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          // Ajuster le header du retry selon la cible
          const isSupabaseEdge = typeof api.defaults.baseURL === 'string' && api.defaults.baseURL.includes('.supabase.co/functions/v1');
          if (!error.config.headers) error.config.headers = {};
          if (isSupabaseEdge) {
            (error.config.headers as any)['x-user-authorization'] = `Bearer ${data.accessToken}`;
          } else {
            (error.config.headers as any).Authorization = `Bearer ${data.accessToken}`;
          }
          return api.request(error.config);
        } catch (refreshError) {
          // Échec du refresh token : déconnexion
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/';
          return Promise.reject(refreshError);
        }
      } else {
        // Pas de refresh token : déconnexion immédiate
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
