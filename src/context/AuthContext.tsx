import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'client';
  companyName?: string;
  phone?: string;
  status: 'active' | 'suspended';
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; role?: string; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nexus_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize & check existing session via GET /api/auth/me
  const checkAuth = async (activeToken?: string | null) => {
    const currentToken = activeToken !== undefined ? activeToken : token;
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }

      // Include credentials so HttpOnly cookies are transmitted
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          // If we had no localStorage token, save it if returned or continue with cookie
          return;
        }
      }

      // If /api/auth/me failed with 401, session is invalid
      setUser(null);
      setToken(null);
      localStorage.removeItem('nexus_token');
    } catch (err: any) {
      console.warn('[AuthContext] Session verification check failed:', err.message);
      setUser(null);
      setToken(null);
      localStorage.removeItem('nexus_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // transmits and accepts HttpOnly cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.message || 'Invalid email or password. Please verify your credentials.';
        setError(errorMsg);
        setLoading(false);
        return { success: false, error: errorMsg };
      }

      // Successful login
      setUser(data.user);
      setToken(data.token);
      if (data.token) {
        localStorage.setItem('nexus_token', data.token);
      }
      setLoading(false);

      return {
        success: true,
        role: data.user.role,
      };
    } catch (err: any) {
      const networkError = err.message || 'Network connection failed. Unable to reach authentication server.';
      setError(networkError);
      setLoading(false);
      return { success: false, error: networkError };
    }
  };

  const logout = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[AuthContext] Logout request error:', err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('nexus_token');
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
