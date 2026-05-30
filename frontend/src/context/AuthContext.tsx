import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  organizationId?: string;
  organizationName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper to store refresh token
  const getStoredRefreshToken = () => localStorage.getItem('refreshToken');
  const setStoredRefreshToken = (token: string) => localStorage.setItem('refreshToken', token);
  const clearStoredRefreshToken = () => localStorage.removeItem('refreshToken');

  // Perform refresh rotation
  const refreshTokens = useCallback(async (): Promise<string | null> => {
    const storedRefresh = getStoredRefreshToken();
    if (!storedRefresh) {
      setLoading(false);
      return null;
    }

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });

      if (!res.ok) {
        // Token was likely revoked or expired
        console.warn('🔄 Refresh token validation failed. Logging out...');
        clearStoredRefreshToken();
        setUser(null);
        setAccessToken(null);
        setLoading(false);
        return null;
      }

      const data = await res.json();
      setAccessToken(data.accessToken);
      setStoredRefreshToken(data.refreshToken);

      // Decode the user from access token
      const decodedUser = jwtDecode<User & { email: string }>(data.accessToken);
      setUser({
        id: decodedUser.id,
        email: decodedUser.email,
        firstName: decodedUser.firstName,
        lastName: decodedUser.lastName,
        role: decodedUser.role,
        organizationId: decodedUser.organizationId,
      });

      return data.accessToken;
    } catch (err) {
      console.error('❌ Error during token refresh rotation:', err);
      clearStoredRefreshToken();
      setUser(null);
      setAccessToken(null);
      setLoading(false);
      return null;
    }
  }, []);

  // Fetch API with automated Authorization headers and 401 handling
  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    let currentToken = accessToken;

    // Set auth header helper
    const getHeaders = (token: string | null) => {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    };

    // 1. Fire original request
    let response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: getHeaders(currentToken),
    });

    // 2. Intercept 401 and try Refresh Token Rotation
    if (response.status === 401) {
      console.log('🔄 Access Token expired, attempting refresh rotation...');
      const renewedToken = await refreshTokens();
      
      if (renewedToken) {
        // Retry the original request with the new access token
        response = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: getHeaders(renewedToken),
        });
      }
    }

    return response;
  }, [accessToken, refreshTokens]);

  // Auth Operations
  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Login failed');
    }

    const data = await res.json();
    setUser(data.user);
    setAccessToken(data.accessToken);
    setStoredRefreshToken(data.refreshToken);
  };

  const register = async (data: RegisterData) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Registration failed');
    }
  };

  const logout = async () => {
    const storedRefresh = getStoredRefreshToken();
    try {
      if (storedRefresh) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefresh }),
        });
      }
    } catch (err) {
      console.error('❌ Logout api error:', err);
    } finally {
      clearStoredRefreshToken();
      setUser(null);
      setAccessToken(null);
    }
  };

  // Initial session restoration
  useEffect(() => {
    const initAuth = async () => {
      const storedRefresh = getStoredRefreshToken();
      if (storedRefresh) {
        await refreshTokens();
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshTokens]);

  // Token auto-refresh timer setup (rotates access token periodically before it expires)
  useEffect(() => {
    if (!accessToken) return;

    try {
      const decoded = jwtDecode<{ exp: number }>(accessToken);
      const expiryTime = decoded.exp * 1000;
      const timeToRefresh = expiryTime - Date.now() - 60000; // Refresh 1 minute before expiry

      if (timeToRefresh > 0) {
        const timer = setTimeout(() => {
          console.log('⏰ Auto-refresh timer triggered...');
          refreshTokens();
        }, timeToRefresh);

        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.error('⚠️ Failed to setup auto-refresh timer:', err);
    }
  }, [accessToken, refreshTokens]);

  const value = {
    user,
    accessToken,
    loading,
    login,
    register,
    logout,
    apiFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
