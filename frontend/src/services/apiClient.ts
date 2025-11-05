import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
});

api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

  config.headers = config.headers ?? {};

  // Si l'API cible est une Edge Function Supabase
  const isSupabaseEdge = typeof api.defaults.baseURL === 'string' && api.defaults.baseURL.includes('.supabase.co/functions/v1');
  if (isSupabaseEdge && anonKey) {
    // Sanitize valeurs (éviter caractères non ASCII dans headers)
    const sanitize = (s?: string) => (s ?? '').replace(/[^\x20-\x7E]/g, '').trim();
    const anon = sanitize(anonKey);
    const at = sanitize(accessToken ?? '');
    // Supabase requiert Authorization + apikey pour atteindre la fonction
    (config.headers as any).Authorization = `Bearer ${anon}`;
    (config.headers as any).apikey = anon;
    // JWT utilisateur dans un header custom
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
