import { useCallback, useEffect, useState } from 'react';

import api from '../services/apiClient';

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

export function useAuth() {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAccess = localStorage.getItem('accessToken');
    const storedRefresh = localStorage.getItem('refreshToken');
    if (storedAccess && storedRefresh) {
      setTokens({ accessToken: storedAccess, refreshToken: storedRefresh });
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<Tokens>('/api/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setTokens(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setTokens(null);
    window.location.reload();
  }, []);

  return { tokens, login, logout, loading };
}
