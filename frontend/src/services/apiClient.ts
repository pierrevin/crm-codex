import axios from 'axios';

// Construire l'URL de base pour l'API Supabase Edge Function
const SUPABASE_URL_FALLBACK = 'https://oecbrtyeqatieeybjvhj.supabase.co';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK;
const API_BASE_URL = import.meta.env.VITE_API_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : 'http://localhost:3000');

const api = axios.create({
  baseURL: API_BASE_URL
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

// Flag pour éviter les boucles infinies lors du refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si c'est déjà une requête de refresh qui échoue, ne pas réessayer
    if (originalRequest?.url?.includes('/api/auth/refresh')) {
      // Échec du refresh token : déconnexion
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/';
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Si un refresh est déjà en cours, ajouter la requête à la queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            const isSupabaseEdge = typeof api.defaults.baseURL === 'string' && api.defaults.baseURL.includes('.supabase.co/functions/v1');
            if (!originalRequest.headers) originalRequest.headers = {};
            if (isSupabaseEdge) {
              (originalRequest.headers as any)['x-user-authorization'] = `Bearer ${token}`;
            } else {
              (originalRequest.headers as any).Authorization = `Bearer ${token}`;
            }
            return api.request(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lY2JydHllcWF0aWVleWJqdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTUyMDIsImV4cCI6MjA3NTQ5MTIwMn0.Z4u7oicInUcPjT19p71NRyu6ck63HSXHByH8uL5-IvY';
          // Créer une instance axios séparée pour éviter la récursion
          const refreshResponse = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken }, {
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey
            }
          });
          
          const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
          localStorage.setItem('accessToken', accessToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          // Traiter la queue
          processQueue(null, accessToken);

          // Retry de la requête originale
          const isSupabaseEdge = typeof api.defaults.baseURL === 'string' && api.defaults.baseURL.includes('.supabase.co/functions/v1');
          if (!originalRequest.headers) originalRequest.headers = {};
          if (isSupabaseEdge) {
            (originalRequest.headers as any)['x-user-authorization'] = `Bearer ${accessToken}`;
          } else {
            (originalRequest.headers as any).Authorization = `Bearer ${accessToken}`;
          }
          
          isRefreshing = false;
          return api.request(originalRequest);
        } catch (refreshError: any) {
          // Échec du refresh token : déconnexion
          console.error('Erreur lors du refresh du token:', refreshError?.response?.status, refreshError?.message);
          processQueue(refreshError, null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          isRefreshing = false;
          window.location.href = '/';
          return Promise.reject(refreshError);
        }
      } else {
        // Pas de refresh token : déconnexion
        isRefreshing = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
